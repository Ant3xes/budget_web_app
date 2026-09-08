"use client";

import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ViewAllLink } from "@/components/dashboard/view-all-link";
import { useLocale } from "@/components/locale-provider";
import { Pagination } from "@/components/ui/pagination";
import { formatFixedChargeDate, isDueSoon } from "@/lib/fixed-charges/due-date";
import { formatEuros } from "@/lib/format";

export interface FixedChargeSummaryRow {
  id: string;
  name: string;
  amount_cents: number;
  /** `next_due_date` for an upcoming charge, `last_paid_date` for one already paid this month — see `paid`. */
  date: string;
  icon: string | null;
  paid: boolean;
}

interface FixedChargesSummaryProps {
  /** Active fixed charges either due through the end of the current month or already paid this month — upcoming rows first, then paid ones (see app/(app)/dashboard/page.tsx). */
  charges: FixedChargeSummaryRow[];
  /** Sum of the *upcoming* rows only — same figure `RemainingToLive`'s second value already subtracts. */
  totalCents: number;
}

const PER_PAGE = 5;

/**
 * "Charges fixes" dashboard block, same compact-list gabarit as
 * `savings-goals-summary.tsx` rather than the full management table
 * (`components/fixed-charges/fixed-charges-list.tsx`, which stays the place
 * to actually edit/suspend/mark-paid a charge — this widget links out to
 * it). Also lists charges already paid this month (issue #35), not just
 * upcoming ones — paginated client-side once that combined list grows past
 * a page, same idea as `recent-transactions.tsx`.
 */
export function FixedChargesSummary({ charges, totalCents }: FixedChargesSummaryProps) {
  const { t } = useLocale();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(charges.length / PER_PAGE));
  const pageItems = charges.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <DashboardCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("dashboard.fixedCharges.heading")}</h2>
        <ViewAllLink href="/fixed-charges" />
      </div>
      {charges.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("dashboard.fixedCharges.empty")}</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-zinc-500">
            {t("dashboard.fixedCharges.total")} : <span className="font-semibold text-zinc-800 dark:text-zinc-100">{formatEuros(totalCents)}</span>
          </p>
          <ul className="space-y-2 text-sm">
            {pageItems.map((charge) => {
              const dueSoon = !charge.paid && isDueSoon(charge.date);
              return (
                <li key={charge.id} className="flex items-center justify-between border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-zinc-800">
                  <span className="truncate text-zinc-700 dark:text-zinc-300">
                    {charge.icon && <span className="mr-1">{charge.icon}</span>}
                    {charge.name}
                    <span className={`ml-1.5 text-xs ${dueSoon ? "font-semibold text-red-600 dark:text-red-400" : "text-zinc-400"}`}>
                      · {formatFixedChargeDate(charge.date)}
                      {charge.paid ? (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-status-good">
                          <Check className="h-3 w-3" /> {t("dashboard.fixedCharges.paidBadge")}
                        </span>
                      ) : (
                        dueSoon && (
                          <span className="ml-1 inline-flex items-center gap-0.5">
                            <AlertTriangle className="h-3 w-3" /> {t("dashboard.fixedCharges.dueSoon")}
                          </span>
                        )
                      )}
                    </span>
                  </span>
                  <span className="ml-4 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">{formatEuros(charge.amount_cents)}</span>
                </li>
              );
            })}
          </ul>
          <Pagination page={page} totalPages={totalPages} total={charges.length} onPageChange={setPage} className="mt-3" />
        </>
      )}
    </DashboardCard>
  );
}
