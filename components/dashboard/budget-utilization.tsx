import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { formatEuros } from "@/lib/format";

export interface BudgetRow {
  id: string;
  categoryName: string;
  categoryIcon: string | null;
  amount: number;
  consumed: number;
}

interface BudgetUtilizationProps {
  rows: BudgetRow[];
}

/**
 * "Budgets du mois en cours" progress bars. Extracted verbatim from
 * app/(app)/dashboard/page.tsx — plan §Étape 1 (structural extraction, no
 * visual change). Swapping the hand-rolled bar color ramp for the
 * `BudgetBar` component + validated rhythm colors is Étape 2.
 */
export function BudgetUtilization({ rows }: BudgetUtilizationProps) {
  if (rows.length === 0) return null;

  return (
    <DashboardCard>
      <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Budgets du mois en cours</h2>
      <div className="space-y-3">
        {rows.map((b) => {
          const ratio = b.amount > 0 ? b.consumed / b.amount : 0;
          const pct = Math.min(ratio * 100, 100);
          const barColor = ratio > 1 ? "bg-red-500" : ratio >= 0.8 ? "bg-orange-400" : "bg-green-500";
          return (
            <div key={b.id}>
              <div className="flex items-center justify-between text-sm">
                <span>
                  {b.categoryIcon && <span className="mr-1">{b.categoryIcon}</span>}
                  {b.categoryName}
                </span>
                <span className="text-zinc-500">
                  {formatEuros(b.consumed)} / {formatEuros(b.amount)}
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full bg-zinc-100">
                <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
