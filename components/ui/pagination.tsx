"use client";

import { useLocale } from "@/components/locale-provider";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Singular label for the counted item, e.g. "résultat", "transaction". Defaults to "résultat". */
  itemLabel?: string;
  className?: string;
}

/**
 * Shared Préc./Suiv. pager — extracted from the pattern previously
 * duplicated inline in transaction-list.tsx, now also used by
 * recent-transactions.tsx (dashboard) and account-detail.tsx (accounts).
 * Purely presentational: the caller owns the `page` state and slices/fetches
 * accordingly.
 */
export function Pagination({ page, totalPages, total, onPageChange, itemLabel, className }: PaginationProps) {
  const { t } = useLocale();
  if (totalPages <= 1) return null;

  const label = itemLabel ?? t("common.state.result");

  return (
    <div className={`flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400 ${className ?? ""}`}>
      <span>
        {total} {label}
        {total > 1 ? "s" : ""} — {t("common.pagination.pageOf", { page, totalPages })}
      </span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← {t("common.pagination.previous")}
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-zinc-300 px-3 py-1 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {t("common.pagination.next")} →
        </button>
      </div>
    </div>
  );
}
