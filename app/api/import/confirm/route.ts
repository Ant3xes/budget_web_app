import { randomUUID } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const importRowSchema = z.object({
  hash: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(255),
  amount_cents: z.number().int(),
  kind: z.enum(["expense", "income", "transfer"]),
  category_id: z.string().uuid().nullable().optional(),
  transfer_account_id: z.string().uuid().nullable().optional(),
});

const confirmSchema = z.object({
  account_id: z.string().uuid(),
  transactions: z.array(importRowSchema).min(1).max(500),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json() as unknown;
  const payload = confirmSchema.safeParse(body);
  if (!payload.success) {
    const issue = payload.error.issues[0];
    const path = issue?.path?.join(".") ?? "";
    const msg = issue?.message ?? "Invalid data";
    return NextResponse.json({ error: path ? `${path}: ${msg}` : msg }, { status: 400 });
  }

  const { account_id, transactions } = payload.data;

  // Build all rows, including mirror transactions for paired transfers
  type Row = {
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

  const rows: Row[] = [];
  for (const tx of transactions) {
    const isTransfer = tx.kind === "transfer";
    const mainKind = isTransfer
      ? tx.amount_cents < 0
        ? "transfer_debit"
        : "transfer_credit"
      : tx.kind;
    const transferId = isTransfer && tx.transfer_account_id ? randomUUID() : null;

    rows.push({
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

  const { error } = await supabase.from("transactions").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Report only the directly imported rows (not the auto-generated mirrors)
  const importedCount = transactions.length;
  return NextResponse.json({ ok: true, imported: importedCount });
}
