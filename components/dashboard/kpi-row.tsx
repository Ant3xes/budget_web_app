import { StatTile } from "@/components/ui/stat-tile";
import { formatEuros } from "@/lib/format";

interface KpiRowProps {
  consolidatedBalance: number;
  periodExpense: number;
  periodIncome: number;
  /** e.g. "ce mois", "3 mois" — see period-selector.tsx (plan §Étape 3). */
  periodLabel: string;
}

/**
 * The 3 dashboard KPI cards (solde consolidé, dépenses/revenus de la
 * période). Plan §Étape 2 (visual polish): built on the `StatTile`
 * primitive and the validated `--income`/`--expense` tokens instead of
 * hardcoded `text-red-600`/`text-green-600`. Plan §Étape 3: "Dépenses"/
 * "Revenus" now follow the global period filter instead of being hardcoded
 * to "ce mois" — solde consolidé stays a snapshot, unaffected (see
 * period-selector.tsx's docstring for why).
 */
export function KpiRow({ consolidatedBalance, periodExpense, periodIncome, periodLabel }: KpiRowProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatTile
        label="Solde consolidé"
        value={formatEuros(consolidatedBalance)}
        valueClassName={consolidatedBalance < 0 ? "text-expense" : undefined}
      />
      <StatTile
        label={`Dépenses ${periodLabel}`}
        value={`−${formatEuros(periodExpense)}`}
        valueClassName="text-expense"
      />
      <StatTile
        label={`Revenus ${periodLabel}`}
        value={`+${formatEuros(periodIncome)}`}
        valueClassName="text-income"
      />
    </div>
  );
}
