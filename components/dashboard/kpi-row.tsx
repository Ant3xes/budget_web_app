import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { formatEuros } from "@/lib/format";

interface KpiRowProps {
  consolidatedBalance: number;
  monthExpense: number;
  monthIncome: number;
}

/**
 * The 3 dashboard KPI cards (solde consolidé, dépenses/revenus du mois).
 * Extracted verbatim from app/(app)/dashboard/page.tsx — plan §Étape 1
 * (structural extraction, no visual change). Swapping this markup for a
 * `StatTile` primitive with the validated palette is Étape 2 (visual
 * polish).
 */
export function KpiRow({ consolidatedBalance, monthExpense, monthIncome }: KpiRowProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <DashboardCard>
        <h2 className="text-sm text-zinc-500 dark:text-zinc-400">Solde consolidé</h2>
        <p className={`mt-1 text-xl font-semibold ${consolidatedBalance < 0 ? "text-red-600" : "text-zinc-900 dark:text-zinc-100"}`}>
          {formatEuros(consolidatedBalance)}
        </p>
      </DashboardCard>
      <DashboardCard>
        <h2 className="text-sm text-zinc-500 dark:text-zinc-400">Dépenses ce mois</h2>
        <p className="mt-1 text-xl font-semibold text-red-600">−{formatEuros(monthExpense)}</p>
      </DashboardCard>
      <DashboardCard>
        <h2 className="text-sm text-zinc-500 dark:text-zinc-400">Revenus ce mois</h2>
        <p className="mt-1 text-xl font-semibold text-green-600">+{formatEuros(monthIncome)}</p>
      </DashboardCard>
    </div>
  );
}
