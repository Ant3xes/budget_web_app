import { formatEuros } from "@/lib/format";

/**
 * Shared `ChartTooltipContent` `formatter` render for a single-series chart
 * — extracted from net-worth-chart.tsx and expense-trend-chart.tsx, which
 * had the identical 6-line block (plan §Étape 4 cleanup pass). Not used by
 * cashflow-chart.tsx, whose tooltip needs per-series sign handling instead.
 */
export function EuroTooltipValue({ value }: { value: unknown }) {
  return (
    <span className="font-mono font-medium text-foreground tabular-nums">
      {typeof value === "number" ? formatEuros(value) : String(value ?? "")}
    </span>
  );
}
