"use client";

import { useState } from "react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ViewAllLink } from "@/components/dashboard/view-all-link";
import { useLocale } from "@/components/locale-provider";
import { Pagination } from "@/components/ui/pagination";
import { resolveCategoryName } from "@/lib/i18n/category-name";
import { formatDate, formatEuros } from "@/lib/format";

interface RecentTransaction {
  id: string;
  amount_cents: number;
  date: string;
  description: string | null;
  kind: string;
  categories: { name: string; is_default: boolean; translation_key: string | null } | null;
}

interface RecentTransactionsProps {
  transactions: RecentTransaction[];
}

const PER_PAGE = 10;

/**
 * "Dernières transactions" — shows every expense/income/virement of the
 * currently selected period (see app/(app)/dashboard/page.tsx's `recentTxRes`
 * — previously hardcoded to the current month regardless of the period
 * filter), paginated client-side 10/page via the shared `Pagination`
 * component. The full period's worth of transactions is already fetched
 * server-side, so pagination here is a plain slice — no extra network
 * round-trip.
 */
export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  const { t } = useLocale();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(transactions.length / PER_PAGE));
  const pageItems = transactions.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <DashboardCard>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("dashboard.recentTransactions.heading")}</h2>
        <ViewAllLink href="/transactions" />
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {pageItems.map((tx) => (
          <li key={tx.id} className="flex justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
            <span className="truncate max-w-xs text-zinc-700 dark:text-zinc-300">
              {tx.description ?? t("dashboard.recentTransactions.defaultDescription")}
              {tx.categories?.name && (
                <span className="ml-1.5 text-xs text-zinc-400">· {resolveCategoryName(tx.categories, t)}</span>
              )}
              <span className="ml-1.5 text-xs text-zinc-400">· {formatDate(tx.date)}</span>
              {(tx.kind === "transfer_debit" || tx.kind === "transfer_credit") && (
                <span className="ml-1.5 text-xs text-zinc-400">· {t("dashboard.recentTransactions.transfer")}</span>
              )}
            </span>
            <span className={`ml-4 shrink-0 font-medium ${tx.amount_cents < 0 ? "text-red-600" : "text-green-600"}`}>
              {tx.amount_cents < 0 ? "−" : "+"}
              {formatEuros(Math.abs(tx.amount_cents))}
            </span>
          </li>
        ))}
        {transactions.length === 0 && <li className="text-zinc-500">{t("dashboard.recentTransactions.empty")}</li>}
      </ul>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={transactions.length}
        onPageChange={setPage}
        itemLabel={t("dashboard.recentTransactions.itemLabel")}
        className="mt-3"
      />
    </DashboardCard>
  );
}
