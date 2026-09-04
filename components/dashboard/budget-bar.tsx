import { cn } from "@/lib/utils";

interface BudgetBarProps {
  /** consumed / amount — may exceed 1 (over budget). */
  ratio: number;
  className?: string;
}

const TIERS = {
  good: { fill: "bg-status-good", track: "bg-status-good/15" },
  warning: { fill: "bg-status-warning", track: "bg-status-warning/15" },
  serious: { fill: "bg-status-serious", track: "bg-status-serious/15" },
  critical: { fill: "bg-status-critical", track: "bg-status-critical/15" },
};

function tierFor(ratio: number): keyof typeof TIERS {
  if (ratio > 1) return "critical";
  if (ratio >= 0.9) return "serious";
  if (ratio >= 0.7) return "warning";
  return "good";
}

/**
 * Budget-consumption meter, colored by spending rhythm (green → orange clair
 * → orange foncé → rouge) instead of the previous 3-tier red/orange/green
 * ramp — plan §Étape 2, replaces the near-identical hand-rolled bar in both
 * app/(app)/dashboard/page.tsx's original markup and
 * components/budget/budget-list.tsx (same duplicated ratio/color logic,
 * flagged by /simplify during Étape 1's review). Per the `dataviz` skill's
 * "Meter" spec: the unfilled track is a lighter tint of the fill's own
 * color, not a flat gray, so the state reads across the whole bar.
 */
export function BudgetBar({ ratio, className }: BudgetBarProps) {
  // Both current callers pre-guard `amount > 0 ? consumed / amount : 0`, but
  // this is a shared primitive — don't trust that to hold at every future
  // call site (a NaN ratio would otherwise render `width: "NaN%"` and
  // silently fall through every tierFor() comparison to "good").
  const safeRatio = Number.isFinite(ratio) ? ratio : 0;
  const pct = Math.min(Math.max(safeRatio, 0) * 100, 100);
  const tier = tierFor(safeRatio);

  return (
    <div className={cn("h-2 w-full rounded-full", TIERS[tier].track, className)}>
      <div className={cn("h-2 rounded-full transition-all", TIERS[tier].fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}
