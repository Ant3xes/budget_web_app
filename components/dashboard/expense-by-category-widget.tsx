"use client";

import { useState } from "react";

import { CategoryTransactionsOverlay, type OverlayTransaction } from "@/components/dashboard/category-transactions-overlay";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { useLocale } from "@/components/locale-provider";
import type { Period } from "@/lib/dates/period";
import { formatCategoryWidgetLabel } from "@/lib/i18n/format-period-label";
import { resolveCategoryName } from "@/lib/i18n/category-name";

interface ExpenseByCategoryWidgetProps {
  data: {
    name: string;
    value: number;
    color: string;
    icon?: string | null;
    categoryId: string | null;
    is_default?: boolean;
    translation_key?: string | null;
  }[];
  /** Raw period descriptor — resolved to text here via `formatCategoryWidgetLabel`, not pre-rendered server-side, so it follows the locale. */
  period: Period;
  /** The server-computed current "YYYY-MM" — see lib/i18n/format-period-label.ts. */
  currentMonthValue: string;
  /** This period's expense transactions per category — feeds the click-to-open overlay, resolved server-side (see app/(app)/dashboard/page.tsx). */
  transactionsByCategory: Record<string, OverlayTransaction[]>;
}

/**
 * "Dépenses par catégorie" donut card. A slice click used to navigate to
 * `/expenses?category_id=...`; it now opens `CategoryTransactionsOverlay` in
 * place instead (plan Étape 2), which is why this became a Client Component
 * (needs local state for the overlay + `useLocale()` for the heading).
 */
export function ExpenseByCategoryWidget({ data, period, currentMonthValue, transactionsByCategory }: ExpenseByCategoryWidgetProps) {
  const { t, locale } = useLocale();
  const [overlayCategoryId, setOverlayCategoryId] = useState<string | null>(null);

  // Default (seeded) categories follow the locale, user-created ones never
  // do — resolved here rather than in `computeExpenseByCategory` (a shared,
  // tested aggregation helper also used by /accounts/[id], grouped by raw
  // name) so the chart's grouping logic stays untouched; only the label
  // shown for each already-grouped slice changes.
  const translatedData = data.map((d) => ({ ...d, name: resolveCategoryName({ name: d.name, is_default: d.is_default, translation_key: d.translation_key }, t) }));
  const overlayEntry = translatedData.find((d) => d.categoryId === overlayCategoryId);
  const periodLabel = formatCategoryWidgetLabel(period, currentMonthValue, locale, t);

  return (
    <DashboardCard>
      <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {t("dashboard.expenseByCategory.heading", { period: periodLabel })}
      </h2>
      <DonutChart
        data={translatedData}
        emptyLabel={t("dashboard.expenseByCategory.empty")}
        onSliceClick={setOverlayCategoryId}
      />
      <CategoryTransactionsOverlay
        open={overlayCategoryId !== null}
        onClose={() => setOverlayCategoryId(null)}
        title={t("dashboard.overlay.categoryTitle", { category: overlayEntry?.name ?? "", period: periodLabel })}
        transactions={overlayCategoryId ? (transactionsByCategory[overlayCategoryId] ?? []) : []}
      />
    </DashboardCard>
  );
}
