import { StatTile } from "@/components/ui/stat-tile";
import { formatEuros } from "@/lib/format";

interface SavingsThisMonthProps {
  /** Net `amount_cents` this month across every non-`courant` account. */
  amountCents: number;
}

/**
 * "Épargne ce mois" KPI bubble — net movement this month on every account
 * that isn't `courant` (épargne/livret/PEL/autre). Transfers are stored as
 * two rows (`transfer_debit`/`transfer_credit`), so summing `amount_cents`
 * on these accounts alone already nets a transfer in from a courant account
 * against a transfer back out, with no need to special-case `kind`.
 */
export function SavingsThisMonth({ amountCents }: SavingsThisMonthProps) {
  return (
    <StatTile
      label="Épargne ce mois"
      value={formatEuros(amountCents)}
      valueClassName={amountCents < 0 ? "text-expense" : undefined}
    />
  );
}
