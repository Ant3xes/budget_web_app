"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatEuros, formatEurosAxisTick } from "@/lib/format";

export interface BudgetRow {
  id: string;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  amount: number;
  consumed: number;
}

/** A recharts bar-click event's own `payload` field carries the datum for the clicked segment. */
interface BarClickEvent {
  payload?: { categoryId: string | null };
}

interface BudgetStackedChartProps {
  rows: BudgetRow[];
}

// `--muted` sits almost exactly at the card's own background lightness (see
// app/globals.css), making "remaining" nearly invisible — `--border` is the
// same neutral-gray family but with actual contrast against the card in both
// themes. One constant, referenced everywhere "remaining"'s color is needed
// (chartConfig, the tooltip swatch, and the Bar's own fill) instead of the
// string repeated 3 times.
const REMAINING_COLOR = "var(--border)";

const chartConfig = {
  consumed: { label: "Consommé", color: "var(--status-warning)" },
  remaining: { label: "Restant", color: REMAINING_COLOR },
} satisfies ChartConfig;

/**
 * Same 4-tier spending-rhythm thresholds as `components/dashboard/budget-bar.tsx`
 * (good < 70 % < warning < 90 % < serious < 100 % < critical) — mirrored
 * here rather than imported: that file isn't in this étape's edit scope,
 * and a per-row `<Cell>` fill needs an actual `var(--status-*)` value, not
 * the Tailwind `bg-status-*` utility class `budget-bar.tsx` uses.
 */
function tierColorFor(ratio: number): string {
  if (ratio > 1) return "var(--status-critical)";
  if (ratio >= 0.9) return "var(--status-serious)";
  if (ratio >= 0.7) return "var(--status-warning)";
  return "var(--status-good)";
}

/**
 * "Budgets du mois en cours" — replaces the plain list of `BudgetBar` rows
 * (former `budget-utilization.tsx`) with a vertical (column) stacked bar
 * chart: one column per budget category, "consumed" (colored by
 * spending-rhythm tier) stacked under "remaining" (neutral `--border` —
 * `--muted` used to sit here but is nearly invisible against the card
 * background). Over budget (`consumed >= amount`) clamps "remaining" to 0
 * rather than going negative, mirroring `budget-bar.tsx`'s own over-budget
 * handling. Rows arrive pre-sorted by budget amount descending (see
 * app/(app)/dashboard/page.tsx).
 *
 * Built on the shared `ChartContainer`/`ChartConfig` (see bar-chart.tsx/
 * donut-chart.tsx) for automatic light/dark theming, same as every other
 * recharts widget on this dashboard. Category labels sit below their column
 * instead of a Y-axis, so once there are more than a handful they're angled
 * (same "dense" idiom as bar-chart.tsx's month labels) to avoid overlapping.
 *
 * The former list's per-row drill-down into `/expenses?category_id=...`
 * (only when the budget had a real category) is preserved here as a bar
 * click, since a recharts X-axis category tick isn't naturally a link.
 */
export function BudgetStackedChart({ rows }: BudgetStackedChartProps) {
  const router = useRouter();
  if (rows.length === 0) return null;

  const data = rows.map((b) => {
    const ratio = b.amount > 0 ? b.consumed / b.amount : 0;
    const remaining = b.consumed >= b.amount ? 0 : b.amount - b.consumed;
    return {
      id: b.id,
      categoryId: b.categoryId,
      label: `${b.categoryIcon ? `${b.categoryIcon} ` : ""}${b.categoryName}`,
      consumed: b.consumed,
      remaining,
      ratio,
      amount: b.amount,
      color: tierColorFor(ratio),
    };
  });

  const dense = data.length > 4;
  const bottomMargin = dense ? 44 : 8;

  const handleBarClick = (event: BarClickEvent) => {
    const categoryId = event.payload?.categoryId;
    if (categoryId) router.push(`/expenses?category_id=${categoryId}`);
  };

  return (
    <DashboardCard>
      <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Budgets du mois en cours</h2>
      <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: 280 }}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: bottomMargin }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: dense ? 10 : 12 }}
            interval={0}
            angle={dense ? -35 : 0}
            textAnchor={dense ? "end" : "middle"}
            height={dense ? 56 : 24}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="number"
            tickFormatter={formatEurosAxisTick}
            tick={{ fontSize: 11 }}
            width={48}
            axisLine={false}
            tickLine={false}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={(value, name, item) => {
                  const row = item.payload as (typeof data)[number];
                  const isConsumed = name === "consumed";
                  const swatch = isConsumed ? row.color : REMAINING_COLOR;
                  const label = isConsumed ? "Consommé" : "Restant";
                  return (
                    <div className="flex w-full items-center justify-between gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: swatch }} />
                        <span className="text-muted-foreground">{label}</span>
                      </div>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {typeof value === "number" ? formatEuros(value) : String(value ?? "")}
                      </span>
                    </div>
                  );
                }}
              />
            }
          />
          <Bar
            dataKey="consumed"
            stackId="budget"
            radius={[0, 0, 3, 3]}
            isAnimationActive={false}
            onClick={handleBarClick}
            className="cursor-pointer"
          >
            {data.map((d) => (
              <Cell key={d.id} fill={d.color} />
            ))}
          </Bar>
          <Bar
            dataKey="remaining"
            stackId="budget"
            fill={REMAINING_COLOR}
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
            onClick={handleBarClick}
            className="cursor-pointer"
          />
        </BarChart>
      </ChartContainer>
    </DashboardCard>
  );
}
