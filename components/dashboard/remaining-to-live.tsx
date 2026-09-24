"use client";

import { useLocale } from "@/components/locale-provider";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatEuros } from "@/lib/format";

interface RemainingToLiveProps {
  /** Sum of `courant`-account balances — the money actually available day-to-day. */
  amountCents: number;
  /** Same, minus active fixed charges still due through the end of the current month. */
  afterChargesCents: number;
}

/**
 * "Reste à vivre" (hors charges) KPI card — explicitly scoped to the current
 * month in its label (issue #35). The "with upcoming charges" figure used to
 * be a footer row stacked below the main value; `StatTile`'s label/value/
 * footer slots are all vertical, which doesn't fit a side-by-side need, so
 * this is now a standalone `Card` with two columns instead: "Reste à vivre"
 * on the left, "avec charges à venir" on the right, split by a `divide-x`.
 */
export function RemainingToLive({ amountCents, afterChargesCents }: RemainingToLiveProps) {
  const { t } = useLocale();
  return (
    <Card>
      <CardContent className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <div className="pb-3 sm:pb-0 sm:pr-4">
          <p className="text-sm text-muted-foreground">{t("dashboard.remainingToLive.label")}</p>
          <p className={cn("mt-1 text-xl font-semibold", amountCents < 0 && "text-expense")}>
            {formatEuros(amountCents)}
          </p>
        </div>
        <div className="pt-3 sm:pt-0 sm:pl-4">
          <p className="text-sm text-muted-foreground">{t("dashboard.remainingToLive.afterChargesLabel")}</p>
          <p className={cn("mt-1 text-xl font-semibold", afterChargesCents < 0 && "text-expense")}>
            {formatEuros(afterChargesCents)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
