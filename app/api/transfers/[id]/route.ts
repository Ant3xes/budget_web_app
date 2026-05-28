import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const transferUpdateSchema = z.object({
  amount_cents: z.number().int().positive().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().trim().max(255).optional().nullable(),
});

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

// [id] here is the transfer_id (shared UUID between both transactions)

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: transferId } = await params;
  if (!transferId) {
    return NextResponse.json({ error: "Missing transfer_id" }, { status: 400 });
  }

  const payload = transferUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { amount_cents, date, description } = payload.data;

  // Build updates per kind
  const commonUpdate: Record<string, unknown> = {};
  if (date !== undefined) commonUpdate.date = date;
  if (description !== undefined) commonUpdate.description = description;

  if (amount_cents !== undefined) {
    // Update debit (negative) and credit (positive) separately
    const { error: debitError } = await auth.supabase
      .from("transactions")
      .update({ ...commonUpdate, amount_cents: -amount_cents })
      .eq("transfer_id", transferId)
      .eq("kind", "transfer_debit")
      .eq("user_id", auth.user.id)
      .is("deleted_at", null);

    if (debitError) {
      return NextResponse.json({ error: debitError.message }, { status: 400 });
    }

    const { error: creditError } = await auth.supabase
      .from("transactions")
      .update({ ...commonUpdate, amount_cents })
      .eq("transfer_id", transferId)
      .eq("kind", "transfer_credit")
      .eq("user_id", auth.user.id)
      .is("deleted_at", null);

    if (creditError) {
      return NextResponse.json({ error: creditError.message }, { status: 400 });
    }
  } else if (Object.keys(commonUpdate).length > 0) {
    // No amount change, update both with common fields
    const { error } = await auth.supabase
      .from("transactions")
      .update(commonUpdate)
      .eq("transfer_id", transferId)
      .eq("user_id", auth.user.id)
      .is("deleted_at", null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: transferId } = await params;
  if (!transferId) {
    return NextResponse.json({ error: "Missing transfer_id" }, { status: 400 });
  }

  // Soft-delete both transactions in the pair
  const { error } = await auth.supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("transfer_id", transferId)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
