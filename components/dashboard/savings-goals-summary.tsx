import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { formatEuros } from "@/lib/format";

interface GoalSummary {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  currentCents: number;
  targetCents: number;
}

interface SavingsGoalsSummaryProps {
  goals: GoalSummary[];
}

/**
 * "Objectifs d'épargne" dashboard summary (plan §Étape 3) — a compact
 * progress list, not a full management UI (that stays on /goals). Unlike
 * `BudgetBar`, progress here is never "bad" as it climbs (100% = goal
 * reached), so it's a plain single-color fill rather than a 4-tier rhythm
 * meter — each goal's own `color` (same field as /goals) drives the fill,
 * falling back to the `--status-good` token when unset.
 */
export function SavingsGoalsSummary({ goals }: SavingsGoalsSummaryProps) {
  if (goals.length === 0) return null;

  return (
    <DashboardCard>
      <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Objectifs d&apos;épargne</h2>
      <div className="space-y-3">
        {goals.map((goal) => {
          const pct = goal.targetCents > 0 ? Math.min(100, Math.round((goal.currentCents / goal.targetCents) * 100)) : 0;
          const fillColor = goal.color ?? "var(--status-good)";
          return (
            <div key={goal.id}>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {goal.icon && <span className="mr-1">{goal.icon}</span>}
                  {goal.name}
                </span>
                <span className="text-zinc-500">
                  {formatEuros(goal.currentCents)} / {formatEuros(goal.targetCents)}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-zinc-100 dark:bg-zinc-700">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${pct}%`, backgroundColor: fillColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
