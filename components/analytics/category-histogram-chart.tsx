"use client";

import { useMemo, useState } from "react";

import { DivergingBarChart } from "@/components/analytics/deferred-charts";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { useLocale } from "@/components/locale-provider";
import { resolveCategoryName } from "@/lib/i18n/category-name";
import { sortCategoryHistogram, toggleHiddenId, visibleCategoryHistogram } from "@/lib/analytics/category-histogram";
import { formatEuros } from "@/lib/format";

export interface CategoryHistogramDatum {
  name: string; // raw/untranslated — resolved here via resolveCategoryName
  value: number; // cents (positive)
  color: string;
  is_default?: boolean;
  translation_key?: string | null;
}

interface CategoryHistogramChartProps {
  data: CategoryHistogramDatum[];
}

const ROW_HEIGHT = 30;

/**
 * Horizontal histogram of every expense category of the period (issue 122),
 * with a per-category on/off switch. Toggle state is local (not persisted,
 * all on by default); the data is already fetched server-side, so toggling
 * never reloads the page. Reuses `DivergingBarChart` (axes, tooltip, mobile
 * label width) — values are all positive here.
 */
export function CategoryHistogramChart({ data }: CategoryHistogramChartProps) {
  const { t } = useLocale();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const entries = useMemo(
    () =>
      sortCategoryHistogram(
        data.map((d) => ({ id: d.name, label: resolveCategoryName(d, t), value: d.value, color: d.color })),
      ),
    [data, t],
  );
  const visible = useMemo(() => visibleCategoryHistogram(entries, hidden), [entries, hidden]);

  if (entries.length === 0) return <ChartEmptyState />;

  return (
    <div className="space-y-3">
      {visible.length === 0 ? (
        <p className="flex h-24 items-center justify-center text-sm text-muted-foreground">{t("analytics.categoryHistogram.allHidden")}</p>
      ) : (
        <DivergingBarChart
          data={visible}
          height={Math.max(120, visible.length * ROW_HEIGHT + 32)}
          yAxisWidth={140}
        />
      )}
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2" aria-label={t("analytics.categoryHistogram.toggles")}>
        {entries.map((e) => (
          <li key={e.id}>
            <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                role="switch"
                checked={!hidden.has(e.id)}
                onChange={() => setHidden((h) => toggleHiddenId(h, e.id))}
                className="size-4 shrink-0"
              />
              <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
              <span className="min-w-0 flex-1 break-words">{e.label}</span>
              <span className="font-mono tabular-nums text-muted-foreground">{formatEuros(e.value)}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
