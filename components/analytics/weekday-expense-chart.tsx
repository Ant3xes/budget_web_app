"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { useLocale } from "@/components/locale-provider";
import { EXPENSE_COLOR } from "@/lib/constants";
import { formatEuros, formatEurosAxisTick } from "@/lib/format";
import type { WeekdayExpenseTotal } from "@/lib/accounts/compute-weekday-expense-totals";

interface WeekdayExpenseChartProps {
  data: WeekdayExpenseTotal[];
  height?: number;
}

/**
 * "Dépenses par jour de la semaine" (issue #42) — single-series bar chart,
 * same shell as amount-histogram-chart.tsx (a sibling "how do my expenses
 * break down" view, keyed by weekday instead of amount bucket) — same
 * `--expense` color token every other expense-only chart already uses.
 */
export function WeekdayExpenseChart({ data, height = 240 }: WeekdayExpenseChartProps) {
  const { t } = useLocale();

  const chartConfig = useMemo(
    () => ({ totalCents: { label: t("analytics.weekdayExpense.seriesLabel"), color: EXPENSE_COLOR } }) satisfies ChartConfig,
    [t],
  );

  if (data.every((d) => d.totalCents === 0)) return <ChartEmptyState />;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={formatEurosAxisTick} tick={{ fontSize: 11 }} width={40} axisLine={false} tickLine={false} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (
                <span className="font-mono font-medium text-foreground tabular-nums">
                  {typeof value === "number" ? formatEuros(value) : String(value ?? "")}
                </span>
              )}
            />
          }
        />
        <Bar dataKey="totalCents" fill="var(--color-totalCents)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}
