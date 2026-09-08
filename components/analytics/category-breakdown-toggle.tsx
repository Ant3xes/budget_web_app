"use client";

import { useMemo, useState } from "react";

import { DonutChart } from "@/components/dashboard/donut-chart";
import { useLocale } from "@/components/locale-provider";
import { resolveCategoryName } from "@/lib/i18n/category-name";

type DonutDatum = {
  name: string;
  value: number;
  color: string;
  icon?: string | null;
  categoryId: string | null;
  is_default?: boolean;
  translation_key?: string | null;
};

interface CategoryBreakdownToggleProps {
  /** Raw (untranslated) category names — resolved here via `resolveCategoryName`, same as the dashboard's `ExpenseByCategoryWidget` (a default/seeded category's display name follows the locale; a user-created one never does). */
  monthData: DonutDatum[];
  yearData: DonutDatum[];
  height?: number;
}

/**
 * "Répartition des dépenses par catégorie" with a mois-courant / cumul-annuel
 * toggle (issue #36) — reuses the dashboard's own `DonutChart` rather than a
 * second implementation; both datasets are fetched once server-side (see
 * page.tsx), so the toggle is a pure client-side swap, no refetch.
 */
export function CategoryBreakdownToggle({ monthData, yearData, height = 280 }: CategoryBreakdownToggleProps) {
  const { t } = useLocale();
  const [range, setRange] = useState<"month" | "year">("month");
  const data = useMemo(
    () => (range === "month" ? monthData : yearData).map((d) => ({ ...d, name: resolveCategoryName(d, t) })),
    [range, monthData, yearData, t],
  );

  return (
    <div>
      <div className="mb-2 flex rounded-md border border-zinc-200 text-xs dark:border-zinc-700 w-fit overflow-hidden">
        {(["month", "year"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-2.5 py-1 transition-colors ${
              range === r
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "hover:bg-zinc-50 text-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {r === "month" ? t("analytics.categoryBreakdown.thisMonth") : t("analytics.categoryBreakdown.yearToDate")}
          </button>
        ))}
      </div>
      <DonutChart data={data} height={height} emptyLabel={t("analytics.categoryBreakdown.empty")} />
    </div>
  );
}
