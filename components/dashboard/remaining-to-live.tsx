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

/**
 * "Reste à vivre" (hors charges) KPI bubble — explicitly scoped to the
 * current month in its label (issue #35). The "with upcoming charges"
 * figure used to be a parenthetical caption below the main value; it's now
 * a second label/value pair laid out horizontally next to it instead.
 */
export function RemainingToLive({ amountCents, afterChargesCents }: RemainingToLiveProps) {
  const { t } = useLocale();
  return (
    <StatTile
      label={t("dashboard.remainingToLive.label")}
      value={formatEuros(amountCents)}
      valueClassName={amountCents < 0 ? "text-expense" : undefined}
      footer={
        <div className="mt-2 flex items-center gap-2 border-t border-zinc-100 pt-2 text-sm dark:border-zinc-800">
          <span className="text-muted-foreground">{t("dashboard.remainingToLive.afterChargesLabel")}</span>
          <span className={`font-semibold ${afterChargesCents < 0 ? "text-expense" : ""}`}>
            {formatEuros(afterChargesCents)}
          </span>
        </div>
      }
    />
  );
}
