import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const fixedChargeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount_cents: z.number().int().positive(),
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  account_id: z.string().uuid().optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["active", "suspended", "cancelled"]).optional().default("active"),
});

function advanceDueDate(dateStr: string, frequency: "monthly" | "quarterly" | "yearly"): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  let date = new Date(Date.UTC(y, m - 1, d));
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  while (date < today) {
    if (frequency === "monthly") {
      date.setUTCMonth(date.getUTCMonth() + 1);
    } else if (frequency === "quarterly") {
      date.setUTCMonth(date.getUTCMonth() + 3);
    } else {
      date.setUTCFullYear(date.getUTCFullYear() + 1);
    }
  }
  return date.toISOString().slice(0, 10);
}

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

export async function GET() {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Auto-advance: fetch active charges with past due dates
  const today = new Date().toISOString().slice(0, 10);
  const { data: overdueCharges } = await auth.supabase
    .from("fixed_charges")
    .select("id, next_due_date, frequency")
    .eq("user_id", auth.user.id)
    .eq("status", "active")
    .lt("next_due_date", today)
    .is("deleted_at", null);

  if (overdueCharges && overdueCharges.length > 0) {
    await Promise.all(
      overdueCharges.map((charge) => {
        const newDate = advanceDueDate(
          charge.next_due_date as string,
          charge.frequency as "monthly" | "quarterly" | "yearly",
        );
        return auth.supabase
          .from("fixed_charges")
          .update({ next_due_date: newDate })
          .eq("id", charge.id)
          .eq("user_id", auth.user.id);
      }),
    );
  }

  // Return all non-deleted charges
  const { data, error } = await auth.supabase
    .from("fixed_charges")
    .select(
      "id, name, amount_cents, currency, frequency, next_due_date, status, notes, account_id, category_id, accounts(name), categories(name, color, icon)",
    )
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .order("next_due_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ charges: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = fixedChargeSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { name, amount_cents, frequency, next_due_date, account_id, category_id, notes, status } = payload.data;

  const { error } = await auth.supabase.from("fixed_charges").insert({
    user_id: auth.user.id,
    name,
    amount_cents,
    frequency,
    next_due_date,
    account_id: account_id ?? null,
    category_id: category_id ?? null,
    notes: notes ?? null,
    status,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
