import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { splitShares, type Shares } from "@/lib/shared-expenses/split-shares";
import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";

const importRowSchema = z.object({
  hash: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(255),
  amount_cents: z.number().int(),
  kind: z.enum(["expense", "income", "transfer"]),
  category_id: z.guid().nullable().optional(),
  transfer_account_id: z.guid().nullable().optional(),
  // Personal space only, expenses only: also share the line into a shared space.
  share: z
    .object({
      space_id: z.guid(),
      category_id: z.guid().nullable().optional(),
      payer_share_percent: z.number().min(0).max(100).optional(),
    })
    .nullable()
    .optional(),
});

const confirmSchema = z.object({
  account_id: z.guid(),
  transactions: z.array(importRowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { supabase, user, spaceId } = auth;

  const body = await request.json() as unknown;
  const payload = confirmSchema.safeParse(body);
  if (!payload.success) {
    const issue = payload.error.issues[0];
    const path = issue?.path?.join(".") ?? "";
    const msg = issue?.message ?? "Invalid data";
    return NextResponse.json({ error: path ? `${path}: ${msg}` : msg }, { status: 400 });
  }

  const { account_id, transactions } = payload.data;

  // A share is only valid on an expense of a personal space, towards a shared
  // space the caller belongs to.
  const sharedRows = transactions.filter((tx) => tx.share);
  if (sharedRows.length > 0) {
    if (sharedRows.some((tx) => tx.kind !== "expense")) {
      return NextResponse.json({ error: "Seules les dépenses peuvent être partagées" }, { status: 400 });
    }
    if (auth.space.kind !== "personal") {
      return NextResponse.json({ error: "Le partage n'est possible que depuis un espace personnel" }, { status: 400 });
    }
    const sharedSpaceIds = new Set(auth.spaces.filter((space) => space.kind === "shared").map((space) => space.id));
    if (sharedRows.some((tx) => !sharedSpaceIds.has(tx.share!.space_id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Every account the client names (target + transfer counterparts) must live
  // in the active space. The DB trigger would refuse a foreign account too, but
  // only with a raw constraint error.
  const accountIds = [
    ...new Set([account_id, ...transactions.map((tx) => tx.transfer_account_id).filter((id): id is string => !!id)]),
  ];
  const { data: spaceAccounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .in("id", accountIds);

  if (accountsError) {
    return NextResponse.json({ error: accountsError.message }, { status: 400 });
  }
  const knownAccountIds = new Set((spaceAccounts ?? []).map((account: { id: string }) => account.id));
  if (!accountIds.every((id) => knownAccountIds.has(id))) {
    return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });
  }

  // Build all rows, including mirror transactions for paired transfers
  type Row = {
    id?: string;
    space_id: string;
    user_id: string;
    account_id: string;
    kind: string;
    amount_cents: number;
    currency: string;
    date: string;
    description: string;
    category_id: string | null;
    transfer_id: string | null;
    is_imported: boolean;
    raw_import_data: Record<string, unknown> | null;
  };

  // Members and default split of each distinct target space, loaded once.
  const targets = new Map<string, { memberIds: string[]; defaultPercent: number }>();
  for (const targetId of new Set(sharedRows.map((tx) => tx.share!.space_id))) {
    const [membersResult, spaceResult] = await Promise.all([
      supabase.from("space_members").select("user_id").eq("space_id", targetId),
      supabase.from("spaces").select("default_share_percent").eq("id", targetId).maybeSingle(),
    ]);
    if (membersResult.error) return pgErrorResponse(membersResult.error);
    if (spaceResult.error) return pgErrorResponse(spaceResult.error);
    targets.set(targetId, {
      memberIds: (membersResult.data ?? []).map((row: { user_id: string }) => row.user_id),
      defaultPercent: spaceResult.data?.default_share_percent ?? 50,
    });
  }

  type ShareRow = { space_id: string; source_transaction_id: string; category_id: string | null; shares: Shares };
  const shareRows: ShareRow[] = [];

  const rows: Row[] = [];
  for (const tx of transactions) {
    const isTransfer = tx.kind === "transfer";
    const mainKind = isTransfer
      ? tx.amount_cents < 0
        ? "transfer_debit"
        : "transfer_credit"
      : tx.kind;
    const transferId = isTransfer && tx.transfer_account_id ? randomUUID() : null;

    let id: string | undefined;
    if (tx.share) {
      const target = targets.get(tx.share.space_id)!;
      id = randomUUID();
      try {
        shareRows.push({
          space_id: tx.share.space_id,
          source_transaction_id: id,
          category_id: tx.share.category_id ?? null,
          shares: splitShares(user.id, target.memberIds, tx.share.payer_share_percent ?? target.defaultPercent),
        });
      } catch (error) {
        return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid shares" }, { status: 400 });
      }
    }

    rows.push({
      ...(id ? { id } : {}),
      space_id: spaceId,
      user_id: user.id,
      account_id,
      kind: mainKind,
      amount_cents: tx.amount_cents,
      currency: "EUR",
      date: tx.date,
      description: tx.description,
      category_id: isTransfer ? null : (tx.category_id ?? null),
      transfer_id: transferId,
      is_imported: true,
      raw_import_data: { hash: tx.hash },
    });

    // If a counterpart account was selected, create the mirror transaction
    if (isTransfer && tx.transfer_account_id && transferId) {
      const mirrorKind = mainKind === "transfer_debit" ? "transfer_credit" : "transfer_debit";
      rows.push({
        space_id: spaceId,
        user_id: user.id,
        account_id: tx.transfer_account_id,
        kind: mirrorKind,
        amount_cents: -tx.amount_cents,
        currency: "EUR",
        date: tx.date,
        description: tx.description,
        category_id: null,
        transfer_id: transferId,
        is_imported: false,
        raw_import_data: null,
      });
    }
  }

  // One SQL transaction: the transactions and their shared expenses, or nothing.
  // The function is idempotent: lines already recorded in the account (double
  // click, retry) are skipped, and it returns how many it really inserted.
  const { data: inserted, error } = await supabase.rpc("import_transactions", { p_rows: rows, p_shares: shareRows });

  if (error) {
    return pgErrorResponse(error);
  }

  // Report only the directly imported rows (not the auto-generated mirrors)
  const importedCount = typeof inserted === "number" ? inserted : transactions.length;
  const skippedCount = transactions.length - importedCount;
  return NextResponse.json({
    ok: true,
    imported: importedCount,
    skipped: skippedCount,
    shared: skippedCount === 0 ? shareRows.length : undefined,
  });
}
