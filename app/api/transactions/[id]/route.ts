import { NextResponse } from "next/server";
import { z } from "zod";

import { ConversionError, planConversion, type DbKind } from "@/lib/transactions/convert-transaction";
import { ruleFromCategoryChange, upsertImportRule } from "@/lib/import/rules";
import { withSpace } from "@/lib/spaces/with-space";
import { logApiError } from "@/lib/api/log-error";
import { invalidIdResponse } from "@/lib/api/validate-id";

const transactionUpdateSchema = z.object({
  account_id: z.string().uuid().optional(),
  amount_cents: z.number().int().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  description: z.string().trim().min(1).max(255).optional(),
  category_id: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  // Type change (issue 115). When present the whole edit goes through the
  // atomic convert_transaction SQL function.
  kind: z.enum(["expense", "income", "transfer"]).optional(),
  from_account_id: z.string().uuid().optional().nullable(),
  to_account_id: z.string().uuid().optional().nullable(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const badId = invalidIdResponse(id);
  if (badId) return badId;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { data: existing } = await auth.supabase
    .from("transactions")
    .select("kind, transfer_id, account_id, amount_cents, date, description, notes, category_id")
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = transactionUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { kind: targetKind, from_account_id, to_account_id, ...fields } = payload.data;

  if (targetKind) {
    return convertTransaction(auth, id, existing, targetKind, { ...fields, from_account_id, to_account_id });
  }

  // Without a type, transfer lines still go through the transfer form.
  if (existing.transfer_id) {
    return NextResponse.json({ error: "Les transactions de virement doivent être modifiées via le formulaire Virement" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("transactions")
    .update(fields)
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const rule = await syncImportRule(auth, existing, existing.kind, fields.category_id, fields.description);
  return NextResponse.json({ ok: true, rule });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const badId = invalidIdResponse(id);
  if (badId) return badId;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  // Block deleting transfer transactions individually
  const { data: existing } = await auth.supabase
    .from("transactions")
    .select("transfer_id")
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.transfer_id) {
    return NextResponse.json({ error: "Les transactions de virement doivent être supprimées via le formulaire Virement" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("transactions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

type Auth = NonNullable<Awaited<ReturnType<typeof withSpace>>>;
type Existing = {
  kind: string;
  transfer_id: string | null;
  account_id: string;
  amount_cents: number;
  date: string;
  description: string | null;
  notes: string | null;
  category_id: string | null;
};

// Atomic type change (issue 115): the plan is computed by a pure function, the
// SQL function convert_transaction applies it in one transaction.
async function convertTransaction(
  auth: Auth,
  id: string,
  existing: Existing,
  targetKind: "expense" | "income" | "transfer",
  fields: {
    account_id?: string;
    amount_cents?: number;
    date?: string;
    description?: string;
    category_id?: string | null;
    notes?: string | null;
    from_account_id?: string | null;
    to_account_id?: string | null;
  },
) {
  let plan;
  try {
    plan = planConversion({
      currentKind: existing.kind as DbKind,
      targetKind,
      amountCents: fields.amount_cents ?? existing.amount_cents,
      accountId: fields.account_id ?? existing.account_id,
      fromAccountId: fields.from_account_id,
      toAccountId: fields.to_account_id,
      categoryId: fields.category_id,
    });
  } catch (error) {
    if (error instanceof ConversionError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }

  // Every named account (and the category) must live in the active space.
  const accountIds = [...new Set([plan.accountId, plan.mirror?.accountId].filter((a): a is string => !!a))];
  const { data: accounts, error: accountsError } = await auth.supabase
    .from("accounts")
    .select("id")
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .in("id", accountIds);
  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 400 });
  }
  const knownIds = new Set((accounts ?? []).map((a: { id: string }) => a.id));
  if (!accountIds.every((a) => knownIds.has(a))) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  if (plan.categoryId) {
    const { data: category } = await auth.supabase
      .from("categories")
      .select("id")
      .eq("id", plan.categoryId)
      .eq("space_id", auth.spaceId)
      .eq("kind", plan.kind)
      .is("deleted_at", null)
      .maybeSingle();
    if (!category) {
      return NextResponse.json({ error: "Catégorie introuvable" }, { status: 404 });
    }
  }

  const { error } = await auth.supabase.rpc("convert_transaction", {
    p_id: id,
    p_space_id: auth.spaceId,
    p_kind: plan.kind,
    p_account_id: plan.accountId,
    p_amount_cents: plan.amountCents,
    p_date: fields.date ?? existing.date.slice(0, 10),
    p_description: fields.description ?? existing.description,
    p_category_id: plan.categoryId,
    p_notes: fields.notes === undefined ? existing.notes : fields.notes,
    p_mirror_kind: plan.mirror?.kind ?? null,
    p_mirror_account_id: plan.mirror?.accountId ?? null,
    p_mirror_amount_cents: plan.mirror?.amountCents ?? null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  const rule = await syncImportRule(auth, existing, plan.kind, plan.categoryId, fields.description);
  return NextResponse.json({ ok: true, rule });
}

// Category change -> import rule (issue 116). Never fails the edit: errors are
// logged and the response stays ok.
async function syncImportRule(
  auth: Auth,
  existing: Existing,
  kind: string,
  nextCategoryId: string | null | undefined,
  nextDescription: string | undefined,
): Promise<"created" | "updated" | null> {
  const candidate = ruleFromCategoryChange({
    kind,
    previousCategoryId: existing.category_id,
    nextCategoryId,
    description: nextDescription ?? existing.description,
  });
  if (!candidate) return null;
  try {
    const result = await upsertImportRule(auth.supabase, auth.spaceId, auth.user.id, candidate);
    if (result.status === "error") {
      logApiError("Import rule upsert failed (issue 116)", result);
      return null;
    }
    return result.status;
  } catch (error) {
    logApiError("Import rule upsert failed (issue 116)", error);
    return null;
  }
}
