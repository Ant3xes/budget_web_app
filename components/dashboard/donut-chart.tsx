"use client";

import { useRouter } from "next/navigation";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { formatEuros } from "@/lib/format";

interface DonutDatum {
  name: string;
  value: number;
  color: string;
  categoryId?: string | null;
}

interface DonutChartProps {
  data: DonutDatum[];
  height?: number;
  emptyLabel?: string;
  /**
   * Drill-down base path (plan §Étape 3), e.g. "/expenses" — a slice with a
   * `categoryId` links to `${drillDownBasePath}?category_id=${categoryId}`
   * on click; a slice with no categoryId (e.g. "Sans catégorie") stays
   * non-interactive (there's no "uncategorized" filter on /expenses to link
   * to). A plain string rather than a callback prop: DonutChart is a Client
   * Component but its callers (e.g. expense-by-category-widget.tsx) are
   * Server Components, and a function prop can't cross that boundary.
   */
  drillDownBasePath?: string;
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
export function DonutChart({
  data,
  height = 280,
  emptyLabel = "Aucune dépense",
  drillDownBasePath,
}: DonutChartProps) {
  const router = useRouter();

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
        >
          {data.map((entry, index) => {
            const href =
              drillDownBasePath && entry.categoryId
                ? `${drillDownBasePath}?category_id=${entry.categoryId}`
                : null;
            return (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                onClick={href ? () => router.push(href) : undefined}
                style={{ cursor: href ? "pointer" : "default" }}
              />
            );
          })}
        </Pie>
        <Tooltip
          formatter={(value) => [typeof value === "number" ? formatEuros(value) : String(value ?? ""), ""]}
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "1px solid var(--border)",
            color: "var(--popover-foreground)",
            fontSize: "12px",
            borderRadius: "var(--radius-md)",
          }}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: "12px", color: "var(--muted-foreground)" }}>{value}</span>
          )}
          wrapperStyle={{ paddingTop: "8px" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
