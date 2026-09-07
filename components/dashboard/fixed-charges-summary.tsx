"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { useLocale } from "@/components/locale-provider";
import { formatFixedChargeDate, isDueSoon } from "@/lib/fixed-charges/due-date";
import { formatEuros } from "@/lib/format";

export interface FixedChargeSummaryRow {
  id: string;
  name: string;
  amount_cents: number;
  next_due_date: string;
  icon: string | null;
}

interface FixedChargesSummaryProps {
  /** Active fixed charges due through the end of the current month, sorted by next_due_date ascending. */
  charges: FixedChargeSummaryRow[];
  /** Sum of `charges` — same figure `RemainingToLive`'s parenthetical already subtracts. */
  totalCents: number;
}

/**
 * New "Charges fixes" dashboard block (plan Étape 2), same compact-list
 * gabarit as `savings-goals-summary.tsx` rather than the full management
 * table (`components/fixed-charges/fixed-charges-list.tsx`, which stays the
 * place to actually edit/suspend a charge — this widget links out to it).
 */
export function FixedChargesSummary({ charges, totalCents }: FixedChargesSummaryProps) {
  const { t } = useLocale();

  return (
    <DashboardCard>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("dashboard.fixedCharges.heading")}</h2>
        <Link href="/fixed-charges" className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          {t("common.actions.viewAll")}
        </Link>
      </div>
      {charges.length === 0 ? (
        <p className="text-sm text-zinc-500">{t("dashboard.fixedCharges.empty")}</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-zinc-500">
            {t("dashboard.fixedCharges.total")} : <span className="font-semibold text-zinc-800 dark:text-zinc-100">{formatEuros(totalCents)}</span>
          </p>
          <ul className="space-y-2 text-sm">
            {charges.map((charge) => {
              const dueSoon = isDueSoon(charge.next_due_date);
              return (
                <li key={charge.id} className="flex items-center justify-between border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-zinc-800">
                  <span className="truncate text-zinc-700 dark:text-zinc-300">
                    {charge.icon && <span className="mr-1">{charge.icon}</span>}
                    {charge.name}
                    <span className={`ml-1.5 text-xs ${dueSoon ? "font-semibold text-red-600 dark:text-red-400" : "text-zinc-400"}`}>
                      · {formatFixedChargeDate(charge.next_due_date)}
                      {dueSoon && (
                        <span className="ml-1 inline-flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> {t("dashboard.fixedCharges.dueSoon")}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="ml-4 shrink-0 font-medium text-zinc-700 dark:text-zinc-300">{formatEuros(charge.amount_cents)}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </DashboardCard>
  );
}
