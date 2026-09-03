"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatEuros } from "@/lib/format";
import { EXPENSE_COLOR, INCOME_COLOR } from "@/lib/constants";

export interface BarChartData {
  month: string; // e.g. "Jan", "Fév"
  income: number; // cents
  expense: number; // cents (positive value)
}

interface IncomeExpenseBarChartProps {
  data: BarChartData[];
  height?: number;
}

const chartConfig = {
  income: { label: "Revenus", color: INCOME_COLOR },
  expense: { label: "Dépenses", color: EXPENSE_COLOR },
} satisfies ChartConfig;

/**
 * Plan §Étape 2 (visual polish): rebuilt on the shadcn `ChartContainer` —
 * replaces the manual `useTheme()`/`isDark` color computation (also
 * duplicated in donut-chart.tsx, now fixed too) with the app's design
 * tokens, which the container's own CSS already targets
 * (`recharts-cartesian-grid`, `-tooltip-cursor`, `-cartesian-axis-tick`
 * selectors). Series colors come from the validated `--income`/`--expense`
 * tokens (plan §Étape 0) instead of hardcoded `#22c55e`/`#ef4444`.
 * components/accounts/balance-chart.tsx still has the same duplicated
 * pattern — deferred, it's on the /accounts page, out of this étape's
 * dashboard-only scope.
 */
export function IncomeExpenseBarChart({ data, height = 280 }: IncomeExpenseBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Pas encore de données
      </div>
    );
  }

  const dense = data.length > 8;
  const bottomMargin = dense ? 28 : 4;

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: bottomMargin }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: dense ? 10 : 11 }}
          interval="preserveStartEnd"
          minTickGap={dense ? 8 : 16}
          angle={dense ? -35 : 0}
          textAnchor={dense ? "end" : "middle"}
          height={dense ? 40 : 24}
        />
        <YAxis
          tickFormatter={(v: number) => {
            const euros = v / 100;
            if (Math.abs(euros) >= 10_000) {
              return `${(euros / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}k€`;
            }
            return `${euros.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€`;
          }}
          tick={{ fontSize: 11 }}
          width={48}
          axisLine={false}
          tickLine={false}
        />
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
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" fill="var(--color-income)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
