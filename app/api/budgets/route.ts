import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const budgetSchema = z.object({
  category_id: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Format YYYY-MM requis"),
  amount_cents: z.number().int().positive(),
});

const querySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
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
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) {
    return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const { month } = query.data;

  let builder = auth.supabase
    .from("budgets")
    .select("id, category_id, month, amount_cents, currency, categories(name, color, icon)")
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .order("month", { ascending: false });

  let monthStart: string | undefined;
  let nextMonthStart: string | undefined;

  if (month) {
    monthStart = `${month}-01`;
    const [year, mon] = month.split("-").map(Number) as [number, number];
    nextMonthStart =
      mon === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(mon + 1).padStart(2, "0")}-01`;
    builder = builder.gte("month", monthStart).lt("month", nextMonthStart);
  }

  const { data: budgets, error } = await builder;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // Fetch consumption (sum of expenses per category) for the requested month
  let consumption: Record<string, number> = {};
  if (month && monthStart && nextMonthStart) {
    const { data: txData, error: txError } = await auth.supabase
      .from("transactions")
      .select("category_id, amount_cents")
      .eq("user_id", auth.user.id)
      .eq("kind", "expense")
      .gte("date", monthStart)
      .lt("date", nextMonthStart)
      .is("deleted_at", null);

    if (!txError && txData) {
      consumption = txData.reduce<Record<string, number>>((acc, tx) => {
        if (tx.category_id) {
          acc[tx.category_id] = (acc[tx.category_id] ?? 0) + Math.abs(tx.amount_cents);
        }
        return acc;
      }, {});
    }
  }

  return NextResponse.json({ budgets: budgets ?? [], consumption });
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = budgetSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { category_id, month, amount_cents } = payload.data;
  const monthDate = `${month}-01`;

  const { error } = await auth.supabase.from("budgets").insert({
    user_id: auth.user.id,
    category_id,
    month: monthDate,
    amount_cents,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Une enveloppe existe déjà pour cette catégorie ce mois" },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
