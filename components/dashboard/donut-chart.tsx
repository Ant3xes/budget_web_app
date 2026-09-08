"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { TooltipContentProps } from "recharts";
import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";
import { formatEuros } from "@/lib/format";

interface DonutDatum {
  name: string;
  value: number;
  color: string;
  icon?: string | null;
  categoryId?: string | null;
}

interface DonutChartProps {
  data: DonutDatum[];
  height?: number;
  emptyLabel?: string;
  /**
   * Drill-down base path, e.g. "/expenses" — a slice links to
   * `${drillDownBasePath}?category_id=${categoryId}` on click (the
   * "Sans catégorie" slice sends `UNCATEGORIZED_CATEGORY_ID`, same as
   * `onSliceClick` below — a consumer needs to handle that sentinel the way
   * `/transactions` does). Currently unused: neither /accounts/[id]
   * (account-detail.tsx) nor /budget (budget-list.tsx) passes it, so their
   * donuts stay purely visual. Kept for a future caller that wants a
   * full-page-navigation drill-down instead of `onSliceClick`'s in-place
   * overlay.
   */
  drillDownBasePath?: string;
  /**
   * Slice-click callback (plan Étape 2, dashboard only) — previously the
   * dashboard's donut also navigated via `drillDownBasePath`; it now opens
   * an in-place overlay instead, see `category-transactions-overlay.tsx`.
   * Takes priority over `drillDownBasePath` when both are given (a caller
   * only ever passes one). Called for every slice, including one with no
   * `categoryId` (e.g. "Sans catégorie") — that slice reports
   * `UNCATEGORIZED_CATEGORY_ID` instead (issue #35: it used to stay
   * non-interactive, dropping the only way to drill into uncategorized
   * expenses from this chart).
   */
  onSliceClick?: (categoryId: string) => void;
}

/**
 * Plan §Étape 2 (visual polish): the manual `useTheme()`/`isDark` theming
 * (also duplicated in bar-chart.tsx; components/accounts/balance-chart.tsx
 * still has it too — deferred, it's on the /accounts page, out of this
 * étape's dashboard-only scope) is gone. Tooltip/legend now reference the
 * app's CSS tokens directly (`--popover`, `--border`, `--muted-foreground`),
 * which already resolve per light/dark via the app/globals.css cascade
 * fixed in Étape 0, so no JS-side theme detection is needed.
 *
 * Kept on plain `ResponsiveContainer` rather than the shadcn
 * `ChartContainer` (used in bar-chart.tsx): that wrapper's value is its
 * config-driven `ChartTooltipContent`/`ChartLegendContent` and its CSS
 * selectors for cartesian grids/axes — none of which apply here (a pie has
 * no axes, and each slice's color is per-category user data, not a static
 * config). Wrapping it anyway for an empty `config={{}}` would import that
 * machinery for zero benefit.
 *
 * Per-category colors stay sourced from each category's own `color` field
 * (user-customizable in Settings), not a fixed series palette — that's for
 * fixed, non-customizable series (see bar-chart.tsx's income/expense).
 */

/**
 * Custom tooltip content, replacing recharts' built-in `<Tooltip
 * formatter={...}>` (which has no way to guarantee the swatch matches the
 * slice's own color, and drops the category icon entirely). Mirrors the
 * icon + color-dot + name visual from components/category-badge.tsx so the
 * tooltip reads consistently with the rest of the app.
 */
function DonutTooltipContent({ active, payload }: TooltipContentProps<ValueType, NameType>) {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const datum = entry.payload as DonutDatum;

  return (
    <div
      style={{
        backgroundColor: "var(--popover)",
        border: "1px solid var(--border)",
        color: "var(--popover-foreground)",
        fontSize: "12px",
        borderRadius: "var(--radius-md)",
        padding: "6px 10px",
      }}
    >
      <span className="flex items-center gap-2">
        {datum.icon && <span>{datum.icon}</span>}
        <span
          className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: datum.color }}
        />
        <span>{datum.name}</span>
        <span className="font-medium">
          {typeof entry.value === "number" ? formatEuros(entry.value) : String(entry.value ?? "")}
        </span>
      </span>
    </div>
  );
}

export function DonutChart({
  data,
  height = 280,
  emptyLabel = "Aucune dépense",
  drillDownBasePath,
  onSliceClick,
}: DonutChartProps) {
  const router = useRouter();

  // See ChartContainer's own comment (components/ui/chart.tsx): recharts'
  // ResponsiveContainer can measure a stale/zero size on first mount here
  // too (this chart doesn't go through ChartContainer). Nudge it once.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={height < 240 ? 40 : 60}
          outerRadius={height < 240 ? 70 : 100}
          paddingAngle={2}
          stroke="transparent"
          isAnimationActive={false}
        >
          {data.map((entry, index) => {
            // A slice with no categoryId is "Sans catégorie" — reported as
            // UNCATEGORIZED_CATEGORY_ID rather than left non-interactive.
            const categoryId = entry.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
            const handleClick = onSliceClick
              ? () => onSliceClick(categoryId)
              : drillDownBasePath
                ? () => router.push(`${drillDownBasePath}?category_id=${categoryId}`)
                : undefined;
            return (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                onClick={handleClick}
                style={{ cursor: handleClick ? "pointer" : "default" }}
              />
            );
          })}
        </Pie>
        <Tooltip content={(props) => <DonutTooltipContent {...props} />} />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{value}</span>
          )}
          // A caller can size the chart taller to make room for many
          // categories (see account-detail.tsx), but this is the backstop
          // for whatever height is passed: scroll rather than silently clip
          // once the legend itself would exceed a third of the chart.
          wrapperStyle={{ paddingTop: "8px", maxHeight: Math.round(height * 0.35), overflowY: "auto" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
