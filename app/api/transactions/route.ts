import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchTransferCounterparts } from "@/lib/transactions/transfer-counterparts";
import { uuidSchema } from "@/lib/validation/uuid";

const transactionSchema = z.object({
  account_id: uuidSchema,
  kind: z.enum(["expense", "income"]),
  amount_cents: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(255),
  category_id: uuidSchema.optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

const querySchema = z.object({
  // UI-level kind: "transfer" covers both transfer_debit/transfer_credit,
  // represented by a single row (the debit side) — see the pairing logic
  // below, which mirrors app/api/transfers/route.ts's GET.
  kind: z.enum(["expense", "income", "transfer"]).optional(),
  account_id: uuidSchema.optional(),
  category_id: uuidSchema.optional(),
  // z.coerce.boolean() would treat "?uncategorized=false" as true (any
  // non-empty string is truthy) — only the literal "true" turns it on.
  uncategorized: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(25),
});

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

export async function GET(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = querySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) {
    return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const { kind, account_id, category_id, uncategorized, date_from, date_to, q, page, per_page } = query.data;
  const from = (page - 1) * per_page;
  const to = from + per_page - 1;

  // Map the UI-level kind to DB kinds. "transfer_credit" rows are always
  // excluded here — they're the mirror side of a transfer pair, re-attached
  // below as `to_account` on the representative "transfer_debit" row instead
  // of appearing as their own line.
  let dbKinds: string[];
  if (kind === "expense") dbKinds = ["expense"];
  else if (kind === "income") dbKinds = ["income"];
  else if (kind === "transfer") dbKinds = ["transfer_debit"];
  else dbKinds = ["expense", "income", "transfer_debit"];

  // A transfer has no category, so "uncategorized" only makes sense among
  // expense/income rows — narrow dbKinds accordingly regardless of `kind`.
  if (uncategorized) dbKinds = dbKinds.filter((k) => k === "expense" || k === "income");

  let builder = auth.supabase
    .from("transactions")
    .select(
      "id, kind, amount_cents, currency, date, description, notes, is_imported, transfer_id, account_id, category_id, accounts(name), categories(name, color, icon)",
      { count: "exact" },
    )
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .in("kind", dbKinds)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (account_id) builder = builder.eq("account_id", account_id);
  if (category_id) builder = builder.eq("category_id", category_id);
  if (uncategorized) builder = builder.is("category_id", null);
  if (date_from) builder = builder.gte("date", date_from);
  if (date_to) builder = builder.lte("date", date_to);
  if (q) builder = builder.ilike("description", `%${q}%`);

  const { data, error, count } = await builder;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const transactions = data ?? [];

  // Batch-fetch the counterpart account for any transfer_debit rows on this page.
  const transferIds = transactions
    .filter((t) => t.kind === "transfer_debit" && t.transfer_id)
    .map((t) => t.transfer_id as string);

  const toAccountByTransferId = await fetchTransferCounterparts(auth.supabase, auth.user.id, transferIds);

  const withToAccount = transactions.map((t) => ({
    ...t,
    to_account: t.kind === "transfer_debit" && t.transfer_id ? (toAccountByTransferId[t.transfer_id] ?? null) : null,
  }));

  return NextResponse.json({ transactions: withToAccount, total: count ?? 0 });
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = transactionSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("transactions").insert({
    user_id: auth.user.id,
    account_id: payload.data.account_id,
    kind: payload.data.kind,
    amount_cents: payload.data.amount_cents,
    date: payload.data.date,
    description: payload.data.description,
    category_id: payload.data.category_id ?? null,
    notes: payload.data.notes ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
