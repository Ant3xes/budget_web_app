import { StatTile } from "@/components/ui/stat-tile";
import { formatEuros } from "@/lib/format";

interface RemainingToLiveProps {
  /** Sum of `courant`-account balances — the money actually available day-to-day. */
  amountCents: number;
  /** Same, minus active fixed charges still due through the end of the current month. */
  afterChargesCents: number;
}

/** "Reste à vivre" (hors charges) KPI bubble — a `StatTile` with an extra parenthetical line via its `footer` slot. */
export function RemainingToLive({ amountCents, afterChargesCents }: RemainingToLiveProps) {
  return (
    <StatTile
      label="Reste à vivre (hors charges)"
      value={formatEuros(amountCents)}
      valueClassName={amountCents < 0 ? "text-expense" : undefined}
      footer={
        <p className="mt-1 text-xs text-muted-foreground">
          ({formatEuros(afterChargesCents)} en tenant compte des charges à venir)
        </p>
      }
    />
  );
}
