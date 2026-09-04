import { StatTile } from "@/components/ui/stat-tile";
import { formatEuros } from "@/lib/format";

interface KpiRowProps {
  consolidatedBalance: number;
  monthExpense: number;
  monthIncome: number;
}

/**
 * The 3 dashboard KPI cards (solde consolidé, dépenses/revenus du mois).
 * Plan §Étape 2 (visual polish): now built on the `StatTile` primitive and
 * the validated `--income`/`--expense` tokens instead of hardcoded
 * `text-red-600`/`text-green-600`.
 */
export function KpiRow({ consolidatedBalance, monthExpense, monthIncome }: KpiRowProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatTile
        label="Solde consolidé"
        value={formatEuros(consolidatedBalance)}
        valueClassName={consolidatedBalance < 0 ? "text-expense" : undefined}
      />
      <StatTile label="Dépenses ce mois" value={`−${formatEuros(monthExpense)}`} valueClassName="text-expense" />
      <StatTile label="Revenus ce mois" value={`+${formatEuros(monthIncome)}`} valueClassName="text-income" />
    </div>
  );
}
