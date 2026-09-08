"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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
import { formatEuros, formatEurosAxisTick } from "@/lib/format";
import type { YoYPoint } from "@/lib/accounts/compute-year-over-year";

interface YearOverYearChartProps {
  data: YoYPoint[];
  height?: number;
}

/**
 * "Comparaison année sur année" (issue #36) — grouped (not stacked) bars,
 * `current`/`previous` side by side per month so the two are directly
 * comparable in length rather than needing to be summed or diffed visually.
 * Two fixed categorical slots (this-year vs last-year is an identity, not a
 * magnitude ramp, so `--chart-1`/`--chart-2` rather than a sequential ramp).
 */
export function YearOverYearChart({ data, height = 280 }: YearOverYearChartProps) {
  const { t } = useLocale();

  const chartConfig = useMemo(
    () =>
      ({
        current: { label: t("analytics.yearOverYear.current"), color: "var(--chart-1)" },
        previous: { label: t("analytics.yearOverYear.previous"), color: "var(--chart-2)" },
      }) satisfies ChartConfig,
    [t],
  );

  if (data.length === 0) return <ChartEmptyState />;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis tickFormatter={formatEurosAxisTick} tick={{ fontSize: 11 }} width={48} axisLine={false} tickLine={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(value) => (typeof value === "number" ? formatEuros(value) : String(value ?? ""))} />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="previous" fill="var(--color-previous)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
        <Bar dataKey="current" fill="var(--color-current)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
