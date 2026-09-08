"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { useLocale } from "@/components/locale-provider";
import { NET_WORTH_COLOR } from "@/lib/constants";
import type { IncomeExpenseSeriesPoint } from "@/lib/accounts/compute-income-expense-series";

interface SavingsRateChartProps {
  /** Reuses the same series the cash-flow chart already has — no extra query. */
  data: IncomeExpenseSeriesPoint[];
  height?: number;
}

/**
 * "Taux d'épargne mensuel" (issue #36) — (revenus - dépenses) / revenus, as
 * a %. Derived entirely from `computeIncomeExpenseSeries`'s existing output
 * (see app/(app)/analytics/page.tsx), so this widget costs no additional
 * query. A month with 0 income renders 0% rather than an undefined/Infinity
 * ratio — a month with no income has no "rate" to speak of, and 0 keeps the
 * axis well-behaved instead of a chart-breaking outlier.
 *
 * The displayed rate is clamped to [-100, 100]: a near-zero (but non-zero)
 * income month still produces a mathematically valid ratio, just one with
 * no useful meaning at chart scale (e.g. 30€ income vs 500€ expense =
 * -1567%) — left unclamped, that single point stretches the axis so far
 * every other month's real, readable rate flattens to a line against 0%.
 * Clamping keeps the whole series legible; the tooltip shows the exact
 * clamped value too, so it never contradicts what's plotted.
 */
const RATE_CLAMP = 100;

export function SavingsRateChart({ data, height = 220 }: SavingsRateChartProps) {
  const { t } = useLocale();

  const chartConfig = useMemo(
    () => ({ rate: { label: t("analytics.savingsRate.seriesLabel"), color: NET_WORTH_COLOR } }) satisfies ChartConfig,
    [t],
  );

  if (data.length === 0) return <ChartEmptyState />;

  const points = data.map((d) => {
    const raw = d.income > 0 ? Math.round(((d.income - d.expense) / d.income) * 100) : 0;
    return { month: d.month, rate: Math.max(-RATE_CLAMP, Math.min(RATE_CLAMP, raw)) };
  });

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
      <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis
          domain={[-RATE_CLAMP, RATE_CLAMP]}
          tickFormatter={(v: number) => `${v}%`}
          tick={{ fontSize: 11 }}
          width={40}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${value}%`} />} />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="var(--color-rate)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-rate)" }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
