"use client";

import { useLocale } from "@/components/locale-provider";
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
  const { t } = useLocale();
  return (
    <StatTile
      label={t("dashboard.remainingToLive.label")}
      value={formatEuros(amountCents)}
      valueClassName={amountCents < 0 ? "text-expense" : undefined}
      footer={
        <p className="mt-1 text-xs text-muted-foreground">
          {t("dashboard.remainingToLive.footer", { amount: formatEuros(afterChargesCents) })}
        </p>
      }
    />
  );
}
