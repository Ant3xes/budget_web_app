"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/components/theme-provider";
import { formatEuros } from "@/lib/format";

export interface BarChartData {
  month: string; // e.g. "Jan", "Fév"
  income: number; // cents
  expense: number; // cents (positive value)
}

interface IncomeExpenseBarChartProps {
  data: BarChartData[];
  height?: number;
}

export function IncomeExpenseBarChart({ data, height = 280 }: IncomeExpenseBarChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const gridColor = isDark ? "#3f3f46" : "#f0f0f0";
  const tickColor = isDark ? "#a1a1aa" : "#71717a";
  const tooltipStyle = isDark
    ? { backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#fafafa", fontSize: "12px" }
    : { fontSize: "12px" };

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
        Pas encore de données
      </div>
    );
  }

  const dense = data.length > 8;
  const bottomMargin = dense ? 28 : 4;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: bottomMargin }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: dense ? 10 : 11, fill: tickColor }}
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
          tick={{ fontSize: 11, fill: tickColor }}
          width={48}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={(value, name) => [
            typeof value === "number" ? formatEuros(value) : String(value ?? ""),
            name === "income" ? "Revenus" : "Dépenses",
          ]}
          contentStyle={tooltipStyle}
          cursor={{ fill: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: "12px" }}>
              {value === "income" ? "Revenus" : "Dépenses"}
            </span>
          )}
        />
        <Bar dataKey="income" fill="#22c55e" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
