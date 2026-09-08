"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { useLocale } from "@/components/locale-provider";
import { EXPENSE_COLOR } from "@/lib/constants";
import type { HistogramBucket } from "@/lib/accounts/compute-amount-histogram";

interface AmountHistogramChartProps {
  data: HistogramBucket[];
  height?: number;
}

/**
 * "Distribution des montants de transactions" (issue #36) — a single-series
 * histogram (count of expenses per fixed euro range). Sequential-magnitude
 * job but a single hue is enough (no need for a light->dark ramp across 6
 * bars) — same `--expense` token every other expense-only chart already uses.
 */
export function AmountHistogramChart({ data, height = 240 }: AmountHistogramChartProps) {
  const { t } = useLocale();

  const chartConfig = useMemo(
    () => ({ count: { label: t("analytics.histogram.seriesLabel"), color: EXPENSE_COLOR } }) satisfies ChartConfig,
    [t],
  );

  if (data.every((b) => b.count === 0)) return <ChartEmptyState />;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11 }} width={32} axisLine={false} tickLine={false} allowDecimals={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {t("analytics.histogram.tooltipCount", { count: String(value ?? 0) })}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
