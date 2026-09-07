"use client";

import { useLocale } from "@/components/locale-provider";
import { StatTile } from "@/components/ui/stat-tile";
import { formatEuros } from "@/lib/format";

interface ConsolidatedBalanceTileProps {
  amountCents: number;
}

/**
 * Solde consolidé — extracted out of the former `KpiRow` (which bundled it
 * with the period expense/income tiles, see `expense-income-line.tsx`) so it
 * can sit directly beside `BankBubbles` in the dashboard header, per the
 * redesign.
 */
export function ConsolidatedBalanceTile({ amountCents }: ConsolidatedBalanceTileProps) {
  const { t } = useLocale();
  return (
    <StatTile
      label={t("dashboard.consolidatedBalance")}
      value={formatEuros(amountCents)}
      valueClassName={amountCents < 0 ? "text-expense" : undefined}
      footer={<p className="mt-1 text-xs text-muted-foreground">{t("dashboard.consolidatedBalanceFooter")}</p>}
      className="w-56 shrink-0"
    />
  );
}
