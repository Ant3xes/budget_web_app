"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatEurosAxisTick } from "@/lib/format";
import { EXPENSE_COLOR } from "@/lib/constants";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { EuroTooltipValue } from "@/components/euro-tooltip-value";
import type { IncomeExpenseSeriesPoint } from "@/lib/accounts/compute-income-expense-series";

interface ExpenseTrendChartProps {
  data: IncomeExpenseSeriesPoint[];
  height?: number;
}

const chartConfig = {
  expense: { label: "Dépenses", color: EXPENSE_COLOR },
} satisfies ChartConfig;

/** Signed % change of the last point vs the one before it, or null with fewer than 2 points (or a zero baseline — a % change from 0 is undefined). */
function computeMonthOverMonthDelta(data: IncomeExpenseSeriesPoint[]): { pct: number; isIncrease: boolean } | null {
  if (data.length < 2) return null;
  const last = data[data.length - 1]!.expense;
  const previous = data[data.length - 2]!.expense;
  if (previous === 0) return null;
  const pct = ((last - previous) / previous) * 100;
  return { pct, isIncrease: pct > 0 };
}

/**
 * "Tendance des dépenses" line chart with a mois-précédent delta (plan
 * §Étape 4) — the `dataviz` skill's stat-tile `delta` contract (signed,
 * color = direction × whether up is good): more spending is never "good",
 * so an increase renders in `--expense` red and a decrease in `--income`
 * green, regardless of the raw sign.
 */
export function ExpenseTrendChart({ data, height = 240 }: ExpenseTrendChartProps) {
  if (data.length === 0) {
    return <ChartEmptyState />;
  }

  const delta = computeMonthOverMonthDelta(data);

  return (
    <div>
      {delta && (
        <p className={`mb-2 text-sm font-medium ${delta.isIncrease ? "text-expense" : "text-income"}`}>
          {delta.isIncrease ? "▲" : "▼"} {Math.abs(delta.pct).toFixed(0)}% vs mois précédent
        </p>
      )}
      <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis
            tickFormatter={formatEurosAxisTick}
            tick={{ fontSize: 11 }}
            width={48}
            axisLine={false}
            tickLine={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent formatter={(value) => <EuroTooltipValue value={value} />} />
            }
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="var(--color-expense)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--color-expense)" }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}
