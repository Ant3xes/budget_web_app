import Link from "next/link";

import { CategoryBadge } from "@/components/category-badge";
import { BudgetBar } from "@/components/dashboard/budget-bar";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { formatEuros } from "@/lib/format";

export interface BudgetRow {
  id: string;
  categoryId: string | null;
  categoryName: string;
  categoryIcon: string | null;
  categoryColor: string | null;
  amount: number;
  consumed: number;
}

interface BudgetUtilizationProps {
  rows: BudgetRow[];
}

/**
 * "Budgets du mois en cours" progress bars. Plan §Étape 2 (visual polish):
 * now uses `BudgetBar` (4-tier spending-rhythm colors, replacing the
 * hand-rolled 3-tier red/orange/green ramp) and `CategoryBadge` (adds the
 * color dot already shown on the /budget page, previously icon+name only
 * here). Plan §Étape 3: the category badge now links to `/expenses`
 * pre-filtered on that category (drill-down) when the budget has a real
 * category — envelopes with no category (rare, `categoryId` null) stay
 * plain text since there'd be nothing meaningful to filter by.
 */
export function BudgetUtilization({ rows }: BudgetUtilizationProps) {
  if (rows.length === 0) return null;

  return (
    <DashboardCard>
      <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Budgets du mois en cours</h2>
      <div className="space-y-3">
        {rows.map((b) => {
          const ratio = b.amount > 0 ? b.consumed / b.amount : 0;
          const badge = <CategoryBadge name={b.categoryName} icon={b.categoryIcon} color={b.categoryColor} />;
          return (
            <div key={b.id}>
              <div className="flex items-center justify-between text-sm">
                {b.categoryId ? (
                  <Link href={`/expenses?category_id=${b.categoryId}`} className="hover:underline">
                    {badge}
                  </Link>
                ) : (
                  badge
                )}
                <span className="text-zinc-500">
                  {formatEuros(b.consumed)} / {formatEuros(b.amount)}
                </span>
              </div>
              <BudgetBar ratio={ratio} className="mt-1" />
            </div>
          );
        })}
      </div>
    </DashboardCard>
  );
}
