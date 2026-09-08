"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { useLocale } from "@/components/locale-provider";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";
import { resolveCategoryName } from "@/lib/i18n/category-name";
import { formatEuros, formatEurosAxisTick } from "@/lib/format";
import type { CategoryTrendSeries } from "@/lib/accounts/compute-category-trend-series";

interface CategoryTrendChartProps {
  data: CategoryTrendSeries;
  height?: number;
}

// "Autres" has no single category to borrow a color from — a neutral gray
// (distinct from any categorical hue) rather than another chart-N slot,
// same idea as CATEGORY_COLOR_FALLBACK but for an aggregate bucket, not a
// single miscolored category.
const OTHERS_COLOR = "var(--muted-foreground)";

/**
 * "Tendance des dépenses par catégorie" (issue #36) — one line per top
 * category (ranked by total spend over the window, see
 * `computeCategoryTrendSeries`), each in that category's own stored color
 * so it reads consistently with the donut/badges elsewhere rather than a
 * generic series ramp. Capped series count (see the helper) keeps this
 * legible instead of a multi-line spaghetti chart once a user has a dozen+
 * categories.
 */
export function CategoryTrendChart({ data, height = 280 }: CategoryTrendChartProps) {
  const { t } = useLocale();

  const labelFor = (s: CategoryTrendSeries["series"][number]) => {
    if (s.key === "__others__") return t("analytics.categoryTrend.others");
    if (s.key === UNCATEGORIZED_CATEGORY_ID) return t("analytics.categoryTrend.uncategorized");
    return resolveCategoryName({ name: s.name, is_default: s.isDefault, translation_key: s.translationKey }, t);
  };

  const chartConfig = useMemo(
    () =>
      Object.fromEntries(
        data.series.map((s) => [s.key, { label: labelFor(s), color: s.color ?? OTHERS_COLOR }]),
      ) satisfies ChartConfig,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFor closes over `t`, already covered by the `data.series` + implicit locale re-render
    [data.series, t],
  );

  if (data.points.length === 0 || data.series.length === 0) {
    return <ChartEmptyState />;
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
      <LineChart data={data.points} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatEurosAxisTick} tick={{ fontSize: 11 }} width={48} axisLine={false} tickLine={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground">
                      {chartConfig[name as keyof typeof chartConfig]?.label ?? name}
                    </span>
                  </div>
                  <span className="font-mono font-medium text-foreground tabular-nums">
                    {typeof value === "number" ? formatEuros(value) : String(value ?? "")}
                  </span>
                </div>
              )}
            />
          }
        />
        {/* Legend only for >= 2 series (dataviz skill) — a single-category
            window has just 1 line, already named by the chart's own
            heading, so a legend box would be redundant. */}
        {data.series.length >= 2 && <ChartLegend content={<ChartLegendContent />} />}
        {data.series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            stroke={s.color ?? OTHERS_COLOR}
            strokeWidth={2}
            dot={{ r: 3 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
