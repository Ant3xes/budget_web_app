"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/components/locale-provider";
import type { Period } from "@/lib/dates/period";
import { formatEuros } from "@/lib/format";
import { formatPeriodLabel } from "@/lib/i18n/format-period-label";

interface ExpenseIncomeLineProps {
  periodExpense: number;
  periodIncome: number;
  /** Raw period descriptor (see period-selector.tsx) — resolved to text here via `formatPeriodLabel`, not pre-rendered server-side, so it follows the locale. */
  period: Period;
  /** The server-computed current "YYYY-MM", passed down to avoid a client/server clock mismatch — see lib/i18n/format-period-label.ts. */
  currentMonthValue: string;
}

/**
 * Replaces 2 of the 3 tiles from the former `KpiRow` (solde consolidé now
 * lives in `consolidated-balance-tile.tsx`, next to the bank bubbles) — a
 * single card showing the period's expenses and income on one line instead
 * of two separate tiles, positioned next to `RemainingToLive` per the
 * redesign. Same `Card`/`CardContent` primitives as `StatTile`
 * (components/ui/stat-tile.tsx), just with two values instead of one.
 */
export function ExpenseIncomeLine({ periodExpense, periodIncome, period, currentMonthValue }: ExpenseIncomeLineProps) {
  const { t, locale } = useLocale();
  const periodLabel = formatPeriodLabel(period, currentMonthValue, locale, t);
  return (
    <Card>
      <CardContent>
        <p className="text-sm text-muted-foreground">{t("dashboard.expenseIncome.label", { period: periodLabel })}</p>
        <p className="mt-1 flex items-baseline gap-3 text-xl font-semibold">
          <span className="text-expense">−{formatEuros(periodExpense)}</span>
          <span className="text-sm font-normal text-muted-foreground">·</span>
          <span className="text-income">+{formatEuros(periodIncome)}</span>
        </p>
      </CardContent>
    </Card>
  );
}
