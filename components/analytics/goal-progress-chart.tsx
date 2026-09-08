"use client";

import { useMemo } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { useLocale } from "@/components/locale-provider";
import { formatEuros, formatEurosAxisTick } from "@/lib/format";
import type { GoalProgressSeriesPoint } from "@/lib/savings-goals/compute-goal-progress-series";

interface ManualGoal {
  id: string;
  name: string;
  currentCents: number;
  targetCents: number;
}

interface GoalProgressChartProps {
  points: GoalProgressSeriesPoint[];
  series: { key: string; name: string; color: string | null }[];
  /** Goals with no linked category — no transaction history to chart, shown as a plain current-value list instead. */
  manualGoals: ManualGoal[];
  height?: number;
}

const FALLBACK_COLOR = "var(--status-good)";

/**
 * "Progression des objectifs d'épargne dans le temps" (issue #36) —
 * cumulative monthly contribution per goal linked to a category, each in
 * that goal's own stored `color` (same field `savings-goals-summary.tsx`
 * already uses) so a goal's line agrees with its progress bar elsewhere.
 * Manual goals (no linked category) have no monthly history to plot — see
 * `computeGoalProgressSeries` — listed underneath by current value instead
 * of forcing a flat, meaningless line onto the chart.
 */
export function GoalProgressChart({ points, series, manualGoals, height = 260 }: GoalProgressChartProps) {
  const { t } = useLocale();

  const chartConfig = useMemo(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.name, color: s.color ?? FALLBACK_COLOR }])) satisfies ChartConfig,
    [series],
  );

  return (
    <div className="space-y-4">
      {points.length === 0 || series.length === 0 ? (
        <ChartEmptyState />
      ) : (
        <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height }}>
          <LineChart data={points} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={formatEurosAxisTick} tick={{ fontSize: 11 }} width={48} axisLine={false} tickLine={false} />
            <ChartTooltip
              content={
                <ChartTooltipContent formatter={(value) => (typeof value === "number" ? formatEuros(value) : String(value ?? ""))} />
              }
            />
            {/* Legend only for >= 2 series (dataviz skill) — a single linked
                goal's line is already named by the chart's own heading. */}
            {series.length >= 2 && <ChartLegend content={<ChartLegendContent />} />}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color ?? FALLBACK_COLOR}
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}

      {manualGoals.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            {t("analytics.goalProgress.manualHeading")}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {manualGoals.map((g) => (
              <li key={g.id} className="flex items-center justify-between text-zinc-700 dark:text-zinc-300">
                <span>{g.name}</span>
                <span className="text-zinc-500">
                  {formatEuros(g.currentCents)} / {formatEuros(g.targetCents)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
