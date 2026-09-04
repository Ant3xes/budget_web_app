import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { resolveGoalCurrentCents } from "@/lib/savings-goals/resolve-current-amount";

const goalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  target_amount_cents: z.number().int().positive(),
  current_amount_cents: z.number().int().min(0).optional().default(0),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  icon: z.string().trim().max(10).optional().nullable(),
  linked_category_id: z.string().uuid().optional().nullable(),
});

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

  const { data: goals, error } = await auth.supabase
    .from("savings_goals")
    .select("id, name, target_amount_cents, current_amount_cents, deadline, color, icon, linked_category_id, created_at")
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // For linked goals, compute current_amount_cents from transactions
  const linkedIds = (goals ?? [])
    .filter((g) => g.linked_category_id)
    .map((g) => g.linked_category_id as string);

  let categoryTotals: Record<string, number> = {};

  if (linkedIds.length > 0) {
    const { data: txData, error: txError } = await auth.supabase
      .from("transactions")
      .select("category_id, amount_cents")
      .eq("user_id", auth.user.id)
      .in("category_id", linkedIds)
      .is("deleted_at", null);

    if (!txError && txData) {
      categoryTotals = txData.reduce<Record<string, number>>((acc, tx) => {
        if (tx.category_id) {
          acc[tx.category_id] = (acc[tx.category_id] ?? 0) + Math.abs(tx.amount_cents);
        }
        return acc;
      }, {});
    }
  }

  const enriched = (goals ?? []).map((g) => ({
    ...g,
    current_amount_cents: resolveGoalCurrentCents(g, categoryTotals),
  }));

  return NextResponse.json({ goals: enriched });
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = goalSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("savings_goals")
    .insert({ ...payload.data, user_id: auth.user.id })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ goal: data }, { status: 201 });
}
