import { NextResponse } from "next/server";
import { z } from "zod";

import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";
import { uuidSchema } from "@/lib/validation/uuid";

// Reimbursement links (ADR 0004, issue 123).
const COLUMNS = "id, date, description, amount_cents, currency";

const bodySchema = z.object({ expense_id: uuidSchema.nullable() });

/**
 * For an expense: the incoming transactions that reimburse it (`reimbursements`).
 * For an incoming transaction: the expense it reimburses (`target`, or null).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const { data: tx, error } = await auth.supabase
    .from("transactions")
    .select("id, kind, reimburses_transaction_id")
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return pgErrorResponse(error);
  if (!tx) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (tx.kind === "expense") {
    const { data, error: listError } = await auth.supabase
      .from("transactions")
      .select(COLUMNS)
      .eq("space_id", auth.spaceId)
      .eq("reimburses_transaction_id", id)
      .is("deleted_at", null)
      .order("date", { ascending: false });
    if (listError) return pgErrorResponse(listError);
    return NextResponse.json({ reimbursements: data ?? [], target: null });
  }

  if (!tx.reimburses_transaction_id) return NextResponse.json({ reimbursements: [], target: null });
  const { data: target, error: targetError } = await auth.supabase
    .from("transactions")
    .select(COLUMNS)
    .eq("id", tx.reimburses_transaction_id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (targetError) return pgErrorResponse(targetError);
  return NextResponse.json({ reimbursements: [], target: target ?? null });
}

/** Links the incoming transaction `id` to an expense (`expense_id`), or removes the link (`null`). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const payload = bodySchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) return NextResponse.json({ error: "Invalid data" }, { status: 400 });

  // The database triggers enforce: incoming + positive source, active expense
  // of the same space as target, no self-reference.
  const { data, error } = await auth.supabase
    .from("transactions")
    .update({ reimburses_transaction_id: payload.data.expense_id })
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .select("id");
  if (error) return pgErrorResponse(error);
  if (!data || data.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
