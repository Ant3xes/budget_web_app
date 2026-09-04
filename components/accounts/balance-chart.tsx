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
  date: string; // YYYY-MM-DD
  label: string;
  balance: number; // cents
}

interface BalanceChartProps {
  data: BalanceChartData[];
  currency?: string;
}

function formatMoney(cents: number, currency: string): string {
  return (cents / 100).toLocaleString("fr-FR", {
    style: "currency",
    currency: currency.length === 3 ? currency : "EUR",
  });
}

function formatAxisTick(cents: number): string {
  const euros = cents / 100;
  if (Math.abs(euros) >= 10_000) {
    return `${(euros / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}k€`;
  }
  return `${euros.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€`;
}

function formatTooltipDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BalanceChart({ data, currency = "EUR" }: BalanceChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const gridColor = isDark ? "#3f3f46" : "#f0f0f0";
  const tickColor = isDark ? "#a1a1aa" : "#71717a";
  const lineColor = isDark ? "#60a5fa" : "#2563eb";
  const tooltipStyle = isDark
    ? { backgroundColor: "#18181b", border: "1px solid #3f3f46", color: "#fafafa", fontSize: "12px" }
    : { fontSize: "12px" };

  const dense = data.length > 14;
  const bottomMargin = dense ? 28 : 4;

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-zinc-400">
        Pas encore de données
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: bottomMargin }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: dense ? 10 : 11, fill: tickColor }}
          interval="preserveStartEnd"
          minTickGap={dense ? 24 : 12}
          angle={dense ? -35 : 0}
          textAnchor={dense ? "end" : "middle"}
          height={dense ? 40 : 24}
        />
        <YAxis
          tickFormatter={formatAxisTick}
          tick={{ fontSize: 11, fill: tickColor }}
          width={48}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          labelFormatter={(_, payload) => {
            const date = payload?.[0]?.payload?.date as string | undefined;
            return date ? formatTooltipDate(date) : "";
          }}
          formatter={(value) => [
            typeof value === "number" ? formatMoney(value, currency) : String(value ?? ""),
            "Solde",
          ]}
          contentStyle={tooltipStyle}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke={lineColor}
          strokeWidth={2}
          dot={data.length <= 31 ? { r: 2, fill: lineColor } : false}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
