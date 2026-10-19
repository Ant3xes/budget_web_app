import type { Metadata } from "next";

import { TransactionList } from "@/components/transactions/transaction-list";
import { requireSpaceContext } from "@/lib/spaces/context";
import { unwrap } from "@/lib/supabase/unwrap";
import { initialTransactionFilters, transactionListParams } from "@/lib/transactions/list-filters";
import { listTransactions, transactionQuerySchema } from "@/lib/transactions/list-transactions";
import { initialTransactionsSchema, loadInitialAccounts, loadInitialCategories, loadInitialSpaces } from "@/lib/transactions/initial-data";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Historique et filtrage des dépenses, revenus et virements.",
};

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [context, params] = await Promise.all([requireSpaceContext(), searchParams]);
  const { space, supabase, spaceId } = context;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const filters = initialTransactionFilters(first(params.type), first(params.category_id));
  const query = transactionQuerySchema.parse(Object.fromEntries(transactionListParams({ ...filters, accountId: "", dateFrom: "", dateTo: "", q: "" }, 1)));
  const [accounts, categories, spaces, result] = await Promise.all([
    loadInitialAccounts(), loadInitialCategories(), loadInitialSpaces(), listTransactions(supabase, spaceId, query),
  ]);
  const initial = {
    ...initialTransactionsSchema.parse(unwrap(result)), ...accounts, ...categories, ...filters,
    spaceNames: Object.fromEntries(spaces.spaces.map((entry) => [entry.id, entry.name])),
  };

  return (
    <section className="space-y-4">
      <TransactionList spaceKind={space.kind} initial={initial} />
    </section>
  );
}
