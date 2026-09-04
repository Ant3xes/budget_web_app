"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatEurosAxisTick } from "@/lib/format";
import { NET_WORTH_COLOR } from "@/lib/constants";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { EuroTooltipValue } from "@/components/euro-tooltip-value";
import type { BalanceSeriesPoint } from "@/lib/accounts/compute-balance-series";

interface NetWorthChartProps {
  data: BalanceSeriesPoint[];
  height?: number;
}

const chartConfig = {
  balance: { label: "Patrimoine net", color: NET_WORTH_COLOR },
} satisfies ChartConfig;

/**
 * "Patrimoine net" detail chart (plan §Étape 4) — single-series area, built
 * on the shadcn `ChartContainer` (same pattern as bar-chart.tsx). Reuses
 * `computeBalanceSeries` from lib/accounts/compute-balance-series.ts, which
 * already existed (tested) but had zero consumers before this étape — it
 * was written for a single account's balance, but the formula is additive:
 * feeding it *all* accounts' transactions plus the sum of their initial
 * balances gives the aggregate net worth for free, no new aggregation
 * function needed (see app/(app)/analytics/page.tsx).
 */
export function NetWorthChart({ data, height = 280 }: NetWorthChartProps) {
  if (data.length === 0) {
    return <ChartEmptyState />;
  }

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis
          tickFormatter={formatEurosAxisTick}
          tick={{ fontSize: 11 }}
          width={52}
          axisLine={false}
          tickLine={false}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent formatter={(value) => <EuroTooltipValue value={value} />} />
          }
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--color-balance)"
          fill="var(--color-balance)"
          fillOpacity={0.1}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
