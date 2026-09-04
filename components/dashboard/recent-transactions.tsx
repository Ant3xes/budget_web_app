"use client";

import { useState } from "react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { Pagination } from "@/components/ui/pagination";
import { formatDate, formatEuros } from "@/lib/format";

interface RecentTransaction {
  id: string;
  amount_cents: number;
  date: string;
  description: string | null;
  kind: string;
  categories: { name: string } | null;
}

interface RecentTransactionsProps {
  transactions: RecentTransaction[];
}

const PER_PAGE = 10;

/**
 * "Dernières transactions" — now shows every expense/income/virement of the
 * current month (previously a hard-capped top 10, transfers excluded),
 * paginated client-side 10/page via the shared `Pagination` component. The
 * full month's worth of transactions is already fetched server-side
 * (see app/(app)/dashboard/page.tsx), so pagination here is a plain slice —
 * no extra network round-trip.
 */
export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(transactions.length / PER_PAGE));
  const pageItems = transactions.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <DashboardCard>
      <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Dernières transactions</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {pageItems.map((tx) => (
          <li key={tx.id} className="flex justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
            <span className="truncate max-w-xs text-zinc-700 dark:text-zinc-300">
              {tx.description ?? "Transaction"}
              {tx.categories?.name && (
                <span className="ml-1.5 text-xs text-zinc-400">· {tx.categories.name}</span>
              )}
              <span className="ml-1.5 text-xs text-zinc-400">· {formatDate(tx.date)}</span>
              {(tx.kind === "transfer_debit" || tx.kind === "transfer_credit") && (
                <span className="ml-1.5 text-xs text-zinc-400">· Virement</span>
              )}
            </span>
            <span className={`ml-4 shrink-0 font-medium ${tx.amount_cents < 0 ? "text-red-600" : "text-green-600"}`}>
              {tx.amount_cents < 0 ? "−" : "+"}
              {formatEuros(Math.abs(tx.amount_cents))}
            </span>
          </li>
        ))}
        {transactions.length === 0 && <li className="text-zinc-500">Aucune transaction.</li>}
      </ul>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={transactions.length}
        onPageChange={setPage}
        itemLabel="transaction"
        className="mt-3"
      />
    </DashboardCard>
  );
}
