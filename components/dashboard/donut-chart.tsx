"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTheme } from "@/components/theme-provider";

interface DonutChartProps {
  data: { name: string; value: number; color: string }[];
}

function formatEuros(value: number): string {
  return (value / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function DonutChart({ data }: DonutChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const tooltipStyle = isDark
    ? { backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#fafafa", fontSize: "12px" }
    : { fontSize: "12px" };
  const legendColor = isDark ? "#a1a1aa" : undefined;

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
        Aucune dépense ce mois
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          stroke="transparent"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [typeof value === "number" ? formatEuros(value) : String(value ?? ""), ""]}
          contentStyle={tooltipStyle}
        />
        <Legend
          formatter={(value) => <span style={{ fontSize: "12px", color: legendColor }}>{value}</span>}
          wrapperStyle={{ paddingTop: "8px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
