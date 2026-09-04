"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatEuros, formatEurosAxisTick } from "@/lib/format";
import { INCOME_COLOR, EXPENSE_COLOR } from "@/lib/constants";
import { ChartEmptyState } from "@/components/chart-empty-state";
import type { IncomeExpenseSeriesPoint } from "@/lib/accounts/compute-income-expense-series";

interface CashflowChartProps {
  data: IncomeExpenseSeriesPoint[];
  height?: number;
}

const chartConfig = {
  income: { label: "Revenus", color: INCOME_COLOR },
  expenseNegated: { label: "Dépenses", color: EXPENSE_COLOR },
  net: { label: "Net", color: "var(--chart-3)" },
} satisfies ChartConfig;

/**
 * "Cash-flow mensuel" — diverging stacked bars (plan §Étape 4, plan
 * decision: barres empilées, pas de Sankey). Revenus stack upward from
 * zero, dépenses (negated for display) stack downward — same `stackId` on
 * both `<Bar>`s anchors them at a shared zero baseline instead of grouping
 * them side by side like the dashboard's bar-chart.tsx. `net` rides as a
 * thin line (a 3rd categorical slot, `--chart-3`, distinct from
 * income/expense) rather than a redundant 3rd bar.
 */
export function CashflowChart({ data, height = 280 }: CashflowChartProps) {
  if (data.length === 0) {
    return <ChartEmptyState />;
  }

  const chartData = data.map((d) => ({
    month: d.month,
    income: d.income,
    expenseNegated: -d.expense,
    net: d.income - d.expense,
  }));

  return (
    <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
      <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
        <YAxis
          // Fed Math.abs(v): this is a diverging chart (revenus above zero,
          // dépenses negated below), so both directions should read as an
          // unsigned magnitude — direction is already conveyed by position
          // relative to the ReferenceLine at 0, and by color/legend.
          tickFormatter={(v: number) => formatEurosAxisTick(Math.abs(v))}
          tick={{ fontSize: 11 }}
          width={48}
          axisLine={false}
          tickLine={false}
        />
        <ReferenceLine y={0} stroke="var(--border)" />
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
                    {typeof value === "number"
                      ? // `net` is a genuinely signed value (income - expense) —
                        // only `expenseNegated` needs unsigning (it was negated
                        // purely to stack downward from the shared baseline).
                        formatEuros(name === "net" ? value : Math.abs(value))
                      : String(value ?? "")}
                  </span>
                </div>
              )}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="income" stackId="cashflow" fill="var(--color-income)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenseNegated" stackId="cashflow" fill="var(--color-expenseNegated)" radius={[0, 0, 3, 3]} />
        <Line type="monotone" dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={{ r: 4 }} />
      </ComposedChart>
    </ChartContainer>
  );
}
