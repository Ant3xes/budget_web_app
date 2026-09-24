import { NextResponse } from "next/server";
import { z } from "zod";

import { splitShares } from "@/lib/shared-expenses/split-shares";
import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";

const patchSchema = z
  .object({
    category_id: z.guid().nullable().optional(),
    payer_share_percent: z.number().min(0).max(100).optional(),
  })
  .refine((value) => value.category_id !== undefined || value.payer_share_percent !== undefined, {
    message: "Nothing to update",
  });

type Params = { params: Promise<{ id: string }> };

/** Updates the category and/or the split of a shared expense. Payer only (RLS). */
export async function PATCH(request: Request, { params }: Params) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.guid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid shared expense id" }, { status: 400 });
  }

  const payload = patchSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }
  const { category_id, payer_share_percent } = payload.data;

  const update: { category_id?: string | null; shares?: Record<string, number> } = {};
  if (category_id !== undefined) update.category_id = category_id;

  if (payer_share_percent !== undefined) {
    const { data: expense, error: expenseError } = await auth.supabase
      .from("shared_expenses")
      .select("space_id, paid_by")
      .eq("id", id)
      .maybeSingle();
    if (expenseError) return pgErrorResponse(expenseError);
    if (!expense) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (expense.paid_by !== auth.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: members, error: membersError } = await auth.supabase
      .from("space_members")
      .select("user_id")
      .eq("space_id", expense.space_id);
    if (membersError) return pgErrorResponse(membersError);

    try {
      update.shares = splitShares(
        auth.user.id,
        (members ?? []).map((row) => row.user_id),
        payer_share_percent,
      );
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid shares" }, { status: 400 });
    }
  }

  // RLS filters non-payers out silently, so check the row count.
  const { data, error } = await auth.supabase.from("shared_expenses").update(update as never).eq("id", id).select("id");
  if (error) return pgErrorResponse(error);
  if (!data?.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ ok: true });
}

/** Unshares an expense (the source transaction is untouched). Payer only. */
export async function DELETE(_request: Request, { params }: Params) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.guid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid shared expense id" }, { status: 400 });
  }

  const { data, error } = await auth.supabase.from("shared_expenses").delete().eq("id", id).select("id");
  if (error) return pgErrorResponse(error);
  if (!data?.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ ok: true });
}
