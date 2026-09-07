"use client";

import { X } from "lucide-react";

import { ViewAllLink } from "@/components/dashboard/view-all-link";
import { useLocale } from "@/components/locale-provider";
import { formatDate, formatEuros } from "@/lib/format";

export interface OverlayTransaction {
  id: string;
  date: string;
  description: string | null;
  amount_cents: number;
}

interface CategoryTransactionsOverlayProps {
  open: boolean;
  onClose: () => void;
  title: string;
  transactions: OverlayTransaction[];
  /** When set, shows a "voir tout" link (issue #35) to `/transactions` with the same filter this overlay is scoped to — e.g. `/transactions?type=expense&category_id=<id>`. */
  viewAllHref?: string;
}

/**
 * Replaces the donut/budget-chart click's former `router.push("/expenses?
 * category_id=...")` (plan Étape 2) — clicking a chart slice/bar now opens
 * this in-place list instead of navigating away. Both callers
 * (donut-chart.tsx, budget-stacked-chart.tsx) only ever pass expense rows,
 * so amounts render with a fixed "−" prefix rather than branching on sign.
 * Same `fixed inset-0 bg-black/40` overlay chrome as `category-modal.tsx` —
 * no fetch here, `transactions` is data the dashboard page already resolved
 * server-side (see app/(app)/dashboard/page.tsx).
 */
export function CategoryTransactionsOverlay({ open, onClose, title, transactions, viewAllHref }: CategoryTransactionsOverlayProps) {
  const { t } = useLocale();
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-lg bg-white shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-base font-semibold">{title}</h2>
          <div className="flex shrink-0 items-center gap-3">
            {viewAllHref && <ViewAllLink href={viewAllHref} />}
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label={t("common.actions.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto p-4 text-sm">
          {transactions.map((tx) => (
            <li key={tx.id} className="flex justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
              <span className="truncate text-zinc-700 dark:text-zinc-300">
                {tx.description ?? "—"}
                <span className="ml-1.5 text-xs text-zinc-400">· {formatDate(tx.date)}</span>
              </span>
              <span className="ml-4 shrink-0 font-medium text-expense">−{formatEuros(Math.abs(tx.amount_cents))}</span>
            </li>
          ))}
          {transactions.length === 0 && <li className="text-zinc-500">{t("dashboard.overlay.empty")}</li>}
        </ul>
      </div>
    </div>
  );
}
