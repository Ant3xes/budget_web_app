import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const goalUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  target_amount_cents: z.number().int().positive().optional(),
  current_amount_cents: z.number().int().min(0).optional(),
  deadline: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  color: z.string().trim().max(20).optional().nullable(),
  icon: z.string().trim().max(10).optional().nullable(),
  linked_category_id: z.string().uuid().optional().nullable(),
});

const addFundsSchema = z.object({
  action: z.literal("add_funds"),
  amount_cents: z.number().int().positive(),
});

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const body: unknown = await request.json();

  // Detect add_funds action
  const addFunds = addFundsSchema.safeParse(body);
  if (addFunds.success) {
    // Fetch current value first (only relevant for manual goals)
    const { data: goal, error: fetchError } = await auth.supabase
      .from("savings_goals")
      .select("current_amount_cents, linked_category_id")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .is("deleted_at", null)
      .single();

    if (fetchError || !goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    if (goal.linked_category_id) {
      return NextResponse.json({ error: "Cannot manually add funds to a linked goal" }, { status: 400 });
    }

    const newAmount = goal.current_amount_cents + addFunds.data.amount_cents;
    const { error } = await auth.supabase
      .from("savings_goals")
      .update({ current_amount_cents: newAmount })
      .eq("id", id)
      .eq("user_id", auth.user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // Regular update
  const payload = goalUpdateSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("savings_goals")
    .update(payload.data)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await auth.supabase
    .from("savings_goals")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
