import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const importRowSchema = z.object({
  hash: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(255),
  amount_cents: z.number().int(),
  kind: z.enum(["expense", "income"]),
  category_id: z.string().uuid().nullable().optional(),
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

  const body = await request.json();
  const payload = confirmSchema.safeParse(body);
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { account_id, transactions } = payload.data;

  const rows = transactions.map((tx) => ({
    user_id: user.id,
    account_id,
    kind: tx.kind,
    amount_cents: tx.amount_cents,
    currency: "EUR",
    date: tx.date,
    description: tx.description,
    category_id: tx.category_id ?? null,
    is_imported: true,
    raw_import_data: { hash: tx.hash },
  }));

  const { error } = await supabase.from("transactions").insert(rows);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, imported: rows.length });
}
