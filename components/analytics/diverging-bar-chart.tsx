"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { formatEuros, formatEurosAxisTick } from "@/lib/format";

export interface DivergingBarRow {
  id: string;
  label: string;
  value: number; // cents, signed — bar extends left of the zero reference line when negative
  color: string;
  /** First line of the tooltip — defaults to `label` when omitted (e.g. a bank name or an over/under status word, distinct from the row's own axis label). */
  tooltipContext?: string;
}

interface DivergingBarChartProps {
  data: DivergingBarRow[];
  height?: number;
  yAxisWidth?: number;
  /** Formats the tooltip's amount — defaults to the signed value; a caller whose sign is already conveyed by `tooltipContext` (e.g. "Dépassement"/"Restant") can pass `(v) => formatEuros(Math.abs(v))` instead. */
  formatTooltipValue?: (value: number) => string;
}

/**
 * Shared horizontal diverging-bar shell (issue #36) — extracted after
 * `account-balance-breakdown-chart.tsx` and `budget-vs-actual-chart.tsx`
 * turned out to need the identical axes/zero-reference-line/tooltip
 * scaffold, differing only in what each bar's color/tooltip context mean.
 * A donut can't represent a signed value (an overdrawn account, an
 * over-budget category) — a bar extending left of a zero reference line can.
 */
export function DivergingBarChart({ data, height = 280, yAxisWidth = 120, formatTooltipValue = formatEuros }: DivergingBarChartProps) {
  const chartConfig = useMemo(() => ({ value: {} }) satisfies ChartConfig, []);

  if (data.length === 0) return <ChartEmptyState />;

  const dense = data.length > 6;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" tickFormatter={formatEurosAxisTick} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: dense ? 10 : 12 }} width={yAxisWidth} axisLine={false} tickLine={false} />
        <ReferenceLine x={0} stroke="var(--border)" />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, _name, item) => {
                const row = item.payload as DivergingBarRow;
                return (
                  <div className="flex w-full items-center justify-between gap-4">
                    <span className="text-muted-foreground">{row.tooltipContext ?? row.label}</span>
                    <span className="font-mono font-medium text-foreground tabular-nums">
                      {typeof value === "number" ? formatTooltipValue(value) : String(value ?? "")}
                    </span>
                  </div>
                );
              }}
            />
          }
        />
        <Bar dataKey="value" radius={4} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.id} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
