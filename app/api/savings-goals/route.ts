import { demoReadOnlyResponse } from "@/lib/api/demo";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hexColorSchema, isoDateSchema, nonNegativeAmountCentsSchema, positiveAmountCentsSchema } from "@/lib/validation/fields";
import { pgErrorResponse } from "@/lib/spaces/pg-error";

import { withSpace } from "@/lib/spaces/with-space";
import { resolveGoalCurrentCents } from "@/lib/savings-goals/resolve-current-amount";

const goalSchema = z.object({
  name: z.string().trim().min(1).max(120),
  target_amount_cents: positiveAmountCentsSchema,
  current_amount_cents: nonNegativeAmountCentsSchema.optional().default(0),
  deadline: isoDateSchema
    .optional()
    .nullable(),
  color: hexColorSchema.optional().nullable(),
  icon: z.string().trim().max(10).optional().nullable(),
  linked_category_id: z.string().uuid().optional().nullable(),
});

export async function GET() {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: goals, error } = await auth.supabase
    .from("savings_goals")
    .select("id, name, target_amount_cents, current_amount_cents, deadline, color, icon, linked_category_id, created_at")
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) return pgErrorResponse(error);

  // For linked goals, compute current_amount_cents from transactions
  const linkedIds = (goals ?? [])
    .filter((g) => g.linked_category_id)
    .map((g) => g.linked_category_id as string);

  let categoryTotals: Record<string, number> = {};

  if (linkedIds.length > 0) {
    const { data: txData, error: txError } = await auth.supabase
      .from("transactions")
      .select("category_id, amount_cents")
      .eq("space_id", auth.spaceId)
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
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.isDemo) return demoReadOnlyResponse();

  const payload = goalSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("savings_goals")
    .insert({ ...payload.data, space_id: auth.spaceId, user_id: auth.user.id })
    .select("id")
    .single();

  if (error) return pgErrorResponse(error);

  return NextResponse.json({ goal: data }, { status: 201 });
}
