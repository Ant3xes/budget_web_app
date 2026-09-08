import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";

const MONTH_ABBR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export type CategoryTrendTx = {
  date: string; // YYYY-MM-DD
  amount_cents: number; // expense, sign ignored (always summed as a positive spend)
  categoryId: string | null;
  categoryName: string | null; // raw/untranslated — "Sans catégorie" fallback used when null; the caller resolves the locale-following display name (see components/analytics/category-trend-chart.tsx)
  categoryColor: string | null; // the category's own stored color, so this chart's line colors agree with the donut/badges elsewhere rather than a generic series ramp
  categoryIsDefault?: boolean;
  categoryTranslationKey?: string | null;
};

export type CategoryTrendSeriesPoint = { month: string; [seriesKey: string]: number | string };

export type CategoryTrendSeries = {
  points: CategoryTrendSeriesPoint[];
  /** Series to plot, in a fixed order — never more than `maxSeries` entries (the rest fold into a trailing "Autres" series, dataviz skill's categorical-palette rule: a 9th series is never a generated hue). Each `key` is a property on every point in `points`. `color` is `null` for "Autres" — the caller supplies a neutral gray for it. */
  series: { key: string; name: string; color: string | null; isDefault?: boolean; translationKey?: string | null }[];
};

function toYearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function addMonth(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(yyyyMM: string): string {
  const mon = parseInt(yyyyMM.slice(5, 7), 10);
  const yy = yyyyMM.slice(2, 4);
  return `${MONTH_ABBR[mon - 1] ?? yyyyMM} ${yy}`;
}

/**
 * Monthly expense totals per category, for a multi-line trend chart
 * (issue #36 "Tendance des dépenses par catégorie mois par mois").
 * Same month-window semantics as `computeIncomeExpenseSeries`
 * (monthCount/now/endMonth) — mirrored here rather than imported, matching
 * this file family's existing per-file convention (compute-balance-series.ts
 * and compute-income-expense-series.ts each keep their own copy too).
 *
 * Caps the plotted series at `maxSeries` categories (ranked by total spend
 * over the window, ties broken by name) — anything past that folds into a
 * trailing "Autres" series instead of generating more hues than the
 * validated categorical palette has slots for.
 */
export function computeCategoryTrendSeries(
  transactions: CategoryTrendTx[],
  monthCount: number | null = 6,
  now: Date = new Date(),
  endMonth?: string,
  maxSeries = 6,
): CategoryTrendSeries {
  const currentMonth = endMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let startMonth = currentMonth;
  if (monthCount === null) {
    if (transactions.length > 0) {
      const earliest = transactions.reduce((min, tx) => (tx.date < min ? tx.date : min), transactions[0]!.date);
      startMonth = toYearMonth(earliest);
    }
  } else {
    startMonth = addMonth(currentMonth, -(monthCount - 1));
  }

  const months: string[] = [];
  for (let month = startMonth; month <= currentMonth; month = addMonth(month, 1)) months.push(month);

  // Total spend per category over the whole window, to rank which ones get
  // their own series vs fold into "Autres".
  const totalByCategory = new Map<string, number>();
  const metaByCategory = new Map<string, { name: string; color: string | null; isDefault?: boolean; translationKey?: string | null }>();
  for (const tx of transactions) {
    const key = tx.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
    totalByCategory.set(key, (totalByCategory.get(key) ?? 0) + Math.abs(tx.amount_cents));
    if (!metaByCategory.has(key)) {
      metaByCategory.set(key, {
        name: tx.categoryName ?? "Sans catégorie",
        color: tx.categoryColor,
        isDefault: tx.categoryIsDefault,
        translationKey: tx.categoryTranslationKey,
      });
    }
  }

  const rankedKeys = [...totalByCategory.keys()].sort((a, b) => {
    const diff = (totalByCategory.get(b) ?? 0) - (totalByCategory.get(a) ?? 0);
    return diff !== 0 ? diff : (metaByCategory.get(a)?.name ?? "").localeCompare(metaByCategory.get(b)?.name ?? "", "fr");
  });
  const topKeys = new Set(rankedKeys.slice(0, maxSeries));
  const hasOthers = rankedKeys.length > maxSeries;

  const series = rankedKeys
    .filter((k) => topKeys.has(k))
    .map((key) => {
      const meta = metaByCategory.get(key);
      return { key, name: meta?.name ?? key, color: meta?.color ?? null, isDefault: meta?.isDefault, translationKey: meta?.translationKey };
    });
  if (hasOthers) series.push({ key: "__others__", name: "Autres", color: null, isDefault: false, translationKey: null });

  const byMonth = new Map<string, Record<string, number>>();
  for (const month of months) {
    const row: Record<string, number> = {};
    for (const s of series) row[s.key] = 0;
    byMonth.set(month, row);
  }

  for (const tx of transactions) {
    const monthKey = toYearMonth(tx.date);
    const row = byMonth.get(monthKey);
    if (!row) continue;
    const catKey = tx.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
    const seriesKey = topKeys.has(catKey) ? catKey : "__others__";
    row[seriesKey] = (row[seriesKey] ?? 0) + Math.abs(tx.amount_cents);
  }

  const points = months.map((month) => ({ month: formatMonthLabel(month), ...byMonth.get(month)! }));

  return { points, series };
}
