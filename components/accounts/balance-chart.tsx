"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/components/theme-provider";

export interface BalanceChartData {
  month: string; // e.g. "Jan. 26"
  balance: number; // cents
}

interface BalanceChartProps {
  data: BalanceChartData[];
}

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function BalanceChart({ data }: BalanceChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const gridColor = isDark ? "#3f3f46" : "#f0f0f0";
  const tickColor = isDark ? "#a1a1aa" : "#71717a";
  const lineColor = isDark ? "#60a5fa" : "#2563eb";
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
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: tickColor }} />
        <YAxis
          tickFormatter={(v: number) => `${(v / 100).toFixed(0)}€`}
          tick={{ fontSize: 12, fill: tickColor }}
          width={60}
        />
        <Tooltip
          formatter={(value) => [
            typeof value === "number" ? formatEuros(value) : String(value ?? ""),
            "Solde",
          ]}
          contentStyle={tooltipStyle}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={lineColor}
          strokeWidth={2}
          dot={{ r: 3, fill: lineColor }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
