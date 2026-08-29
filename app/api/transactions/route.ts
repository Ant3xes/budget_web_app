import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/validation/uuid";

const transactionSchema = z.object({
  account_id: uuidSchema,
  kind: z.enum(["expense", "income"]),
  amount_cents: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(255),
  category_id: uuidSchema.optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const querySchema = z.object({
  kind: z.enum(["expense", "income", "transfer_debit", "transfer_credit"]).optional(),
  account_id: uuidSchema.optional(),
  category_id: uuidSchema.optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
});

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

export async function GET(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) {
    return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const { kind, account_id, category_id, date_from, date_to, q, page, per_page } = query.data;
  const from = (page - 1) * per_page;
  const to = from + per_page - 1;

  let builder = auth.supabase
    .from("transactions")
    .select(
      "id, kind, amount_cents, currency, date, description, notes, is_imported, transfer_id, account_id, category_id, accounts(name), categories(name, color, icon)",
      { count: "exact" },
    )
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .in("kind", kind ? [kind] : ["expense", "income", "transfer_debit", "transfer_credit"])
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (account_id) builder = builder.eq("account_id", account_id);
  if (category_id) builder = builder.eq("category_id", category_id);
  if (date_from) builder = builder.gte("date", date_from);
  if (date_to) builder = builder.lte("date", date_to);
  if (q) builder = builder.ilike("description", `%${q}%`);

  const { data, error, count } = await builder;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ transactions: data ?? [], total: count ?? 0 });
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = transactionSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("transactions").insert({
    user_id: auth.user.id,
    account_id: payload.data.account_id,
    kind: payload.data.kind,
    amount_cents: payload.data.amount_cents,
    date: payload.data.date,
    description: payload.data.description,
    category_id: payload.data.category_id ?? null,
    notes: payload.data.notes ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
