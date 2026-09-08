"use client";

import { useMemo } from "react";

import { DivergingBarChart } from "@/components/analytics/diverging-bar-chart";
import { useLocale } from "@/components/locale-provider";
import { resolveCategoryName } from "@/lib/i18n/category-name";
import { formatEuros } from "@/lib/format";

export interface BudgetVsActualRow {
  id: string;
  categoryName: string | null;
  categoryIcon: string | null;
  isDefault?: boolean;
  translationKey?: string | null;
  amount: number; // budgeted cents
  consumed: number; // spent cents
}

interface BudgetVsActualChartProps {
  rows: BudgetVsActualRow[];
  height?: number;
}

/**
 * "Budget vs réalisé par catégorie" as a diverging bar chart (issue #36) —
 * a different angle than the dashboard's `budget-stacked-chart.tsx`
 * (consumed/remaining stacked within each budget's own total): here every
 * category shares one zero baseline, bar length is signed
 * (amount - consumed), reading directly as "how far under or over budget".
 * Color follows *polarity* here (diverging: under vs over), not category
 * identity — dataviz skill's color-by-job rule — so this uses the app's
 * two-tier status colors (good/critical) rather than each category's own
 * stored color, unlike category-trend-chart.tsx where color *is* identity.
 * Built on the shared `DivergingBarChart` shell (also used by
 * account-balance-breakdown-chart.tsx).
 */
export function BudgetVsActualChart({ rows, height = 280 }: BudgetVsActualChartProps) {
  const { t } = useLocale();

  const data = useMemo(
    () =>
      rows
        .map((r) => {
          const over = r.consumed > r.amount;
          return {
            id: r.id,
            label: `${r.categoryIcon ? `${r.categoryIcon} ` : ""}${
              r.categoryName
                ? resolveCategoryName({ name: r.categoryName, is_default: r.isDefault, translation_key: r.translationKey }, t)
                : t("analytics.budgetVsActual.noCategory")
            }`,
            value: r.amount - r.consumed,
            color: over ? "var(--status-critical)" : "var(--status-good)",
            tooltipContext: over ? t("analytics.budgetVsActual.over") : t("analytics.budgetVsActual.under"),
          };
        })
        .sort((a, b) => a.value - b.value), // most over-budget first, reads like a ranked list
    [rows, t],
  );

  return <DivergingBarChart data={data} height={height} formatTooltipValue={(v) => formatEuros(Math.abs(v))} />;
}
