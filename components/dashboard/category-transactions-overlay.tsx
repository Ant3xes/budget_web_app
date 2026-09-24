"use client";

import { ViewAllLink } from "@/components/dashboard/view-all-link";
import { useLocale } from "@/components/locale-provider";
import { Modal } from "@/components/ui/modal";
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
 * Rendered through the shared `Modal` primitive —
 * no fetch here, `transactions` is data the dashboard page already resolved
 * server-side (see app/(app)/dashboard/page.tsx).
 */
export function CategoryTransactionsOverlay({ open, onClose, title, transactions, viewAllHref }: CategoryTransactionsOverlayProps) {
  const { t } = useLocale();
  return (
    <Modal
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      closeLabel={t("common.actions.close")}
    >
      {viewAllHref && (
        <div className="mb-3 flex justify-end">
          <ViewAllLink href={viewAllHref} />
        </div>
      )}
      <ul className="space-y-2 text-sm">
        {transactions.map((tx) => (
          <li key={tx.id} className="flex justify-between gap-4 border-b border-border pb-2">
            <span className="min-w-0 truncate text-foreground">
              {tx.description ?? "—"}
              <span className="ml-1.5 text-xs text-muted-foreground">· {formatDate(tx.date)}</span>
            </span>
            <span className="shrink-0 font-medium text-expense">−{formatEuros(Math.abs(tx.amount_cents))}</span>
          </li>
        ))}
        {transactions.length === 0 && <li className="text-muted-foreground">{t("dashboard.overlay.empty")}</li>}
      </ul>
    </Modal>
  );
}
