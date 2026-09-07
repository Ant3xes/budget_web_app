"use client";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { IncomeExpenseBarChart, type BarChartData } from "@/components/dashboard/bar-chart";
import { useLocale } from "@/components/locale-provider";
import type { Period } from "@/lib/dates/period";
import { formatPeriodLabel } from "@/lib/i18n/format-period-label";

interface IncomeVsExpenseWidgetProps {
  data: BarChartData[];
  /** Raw period descriptor — resolved to text here via `formatPeriodLabel`, not pre-rendered server-side, so it follows the locale. */
  period: Period;
  /** The server-computed current "YYYY-MM" — see lib/i18n/format-period-label.ts. */
  currentMonthValue: string;
  /** Whether the trend window was widened to its 6-month floor (see floorMonthWindow in app/(app)/dashboard/page.tsx) — the heading then reads "6 mois"/"6 months" instead of the raw period label. */
  trendIsFloored: boolean;
}

/** "Revenus vs Dépenses" bar chart card. */
export function IncomeVsExpenseWidget({ data, period, currentMonthValue, trendIsFloored }: IncomeVsExpenseWidgetProps) {
  const { t, locale } = useLocale();
  const periodLabel = trendIsFloored ? t("periodSelector.presets.6m").toLowerCase() : formatPeriodLabel(period, currentMonthValue, locale, t);
  return (
    <DashboardCard>
      <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {t("dashboard.incomeVsExpense.heading", { period: periodLabel })}
      </h2>
      <IncomeExpenseBarChart data={data} />
    </DashboardCard>
  );
}
