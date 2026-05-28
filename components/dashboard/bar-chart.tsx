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

interface BarChartData {
  month: string; // e.g. "Jan", "Fév"
  income: number; // cents
  expense: number; // cents (positive value)
}

interface IncomeExpenseBarChartProps {
  data: BarChartData[];
}

function formatEuros(value: number): string {
  return (value / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function IncomeExpenseBarChart({ data }: IncomeExpenseBarChartProps) {
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

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: tickColor }} />
        <YAxis tickFormatter={(v: number) => `${(v / 100).toFixed(0)}€`} tick={{ fontSize: 12, fill: tickColor }} width={52} />
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
