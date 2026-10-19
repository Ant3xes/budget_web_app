import { z } from "zod";
import type { SpaceContext } from "@/lib/spaces/context";
import { fetchTransferCounterparts } from "@/lib/transactions/transfer-counterparts";
import { netExpenseCents, sumReimbursements } from "@/lib/transactions/net-amount";
import { escapeLike } from "@/lib/api/escape-like";
import { uuidSchema } from "@/lib/validation/uuid";

export const transactionQuerySchema = z.object({
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

export async function listTransactions(supabase: SpaceContext["supabase"], spaceId: string, query: z.infer<typeof transactionQuerySchema>) {
  const { kind, account_id, category_id, uncategorized, date_from, date_to, q, page, per_page } = query;
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

  let builder = supabase
    .from("transactions")
    .select(
      "id, kind, amount_cents, currency, date, description, notes, is_imported, raw_import_data, transfer_id, account_id, category_id, reimburses_transaction_id, accounts(name), categories(name, color, icon), shared_expenses(id, space_id, category_id, paid_by, shares)",
      { count: "exact" },
    )
    .eq("space_id", spaceId)
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
  if (q) builder = builder.ilike("description", `%${escapeLike(q)}%`);

  const { data, error, count } = await builder;

  if (error) {
    return { data: null, error };
  }

  const transactions = data ?? [];

  // Batch-fetch the counterpart account for any transfer_debit rows on this page.
  const transferIds = transactions
    .filter((t) => t.kind === "transfer_debit" && t.transfer_id)
    .flatMap((t) => t.transfer_id ? [t.transfer_id] : []);

  const toAccountByTransferId = await fetchTransferCounterparts(supabase, spaceId, transferIds);

  // Issue 123 (ADR 0004): `amount_cents` stays the real (gross) amount, which
  // the edit form needs; the list shows `net_cents` and the reimbursed total.
  const expenseIds = transactions.filter((t) => t.kind === "expense").map((t) => t.id);
  const reimbursedByExpense = new Map<string, number>();
  if (expenseIds.length > 0) {
    const { data: links } = await supabase
      .from("transactions")
      .select("amount_cents, reimburses_transaction_id")
      .eq("space_id", spaceId)
      .in("reimburses_transaction_id", expenseIds)
      .is("deleted_at", null);
    for (const link of links ?? []) {
      const key = link.reimburses_transaction_id;
      if (!key) continue;
      reimbursedByExpense.set(key, (reimbursedByExpense.get(key) ?? 0) + sumReimbursements([link.amount_cents]));
    }
  }

  const withToAccount = transactions.map((t) => ({
    ...t,
    reimbursed_cents: reimbursedByExpense.get(t.id) ?? 0,
    net_cents: t.kind === "expense" ? netExpenseCents(t.amount_cents, reimbursedByExpense.get(t.id) ?? 0) : null,
    to_account: t.kind === "transfer_debit" && t.transfer_id ? (toAccountByTransferId[t.transfer_id] ?? null) : null,
  }));

  return { data: { transactions: withToAccount, total: count ?? 0 }, error: null };
}
