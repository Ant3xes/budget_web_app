"use client";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className={cn("flex items-center justify-between text-sm text-muted-foreground", className)}>
      <span>
        {total} {label}
        {total > 1 ? "s" : ""} — {t("common.pagination.pageOf", { page, totalPages })}
      </span>
      <div className="flex gap-1">
        <Button type="button" variant="outline" size="sm" disabled={page === 1} onClick={() => onPageChange(page - 1)}>
          ← {t("common.pagination.previous")}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          {t("common.pagination.next")} →
        </Button>
      </div>
    </div>
  );
}
