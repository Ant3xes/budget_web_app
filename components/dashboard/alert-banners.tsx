import type { BudgetRow } from "@/components/dashboard/budget-utilization";
import { formatDate, formatEuros } from "@/lib/format";

interface UpcomingCharge {
  id: string;
  name: string;
  amount_cents: number;
  next_due_date: string;
}

interface AlertBannersProps {
  upcomingCharges: UpcomingCharge[];
  /** Same shape as budget-utilization.tsx's rows — this is a filtered subset of it. */
  exceededBudgets: BudgetRow[];
}

/**
 * Dashboard alert banners: fixed charges due soon, budgets over their
 * envelope. Extracted verbatim from app/(app)/dashboard/page.tsx — plan
 * §Étape 1 (structural extraction, no visual change; polish is Étape 2+).
 */
export function AlertBanners({ upcomingCharges, exceededBudgets }: AlertBannersProps) {
  if (upcomingCharges.length === 0 && exceededBudgets.length === 0) return null;

  return (
    <div className="space-y-2">
      {upcomingCharges.map((charge) => (
        <div
          key={charge.id}
          className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
        >
          <span>⚠</span>
          <span>
            Charge fixe <strong>{charge.name}</strong> ({formatEuros(charge.amount_cents)}) — échéance le{" "}
            {formatDate(charge.next_due_date)}
          </span>
        </div>
      ))}
      {exceededBudgets.map((b) => (
        <div
          key={b.id}
          className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700"
        >
          <span>📊</span>
          <span>
            Budget <strong>{b.categoryName}</strong> dépassé — {formatEuros(b.consumed)} /{" "}
            {formatEuros(b.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}
