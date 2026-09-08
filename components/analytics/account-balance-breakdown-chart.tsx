"use client";

import { useMemo } from "react";

import { DivergingBarChart } from "@/components/analytics/diverging-bar-chart";
import { useLocale } from "@/components/locale-provider";
import { colorForBank } from "@/lib/accounts/color-for-bank";
import type { BankGroup } from "@/lib/accounts/group-account-balances";

interface AccountBalanceBreakdownChartProps {
  groups: BankGroup[];
  height?: number;
}

/**
 * "Répartition par banque / par compte" (issue #36) — one bar per account
 * (finer grain than per-bank, since a bank can hold several accounts of
 * very different balances), colored by its bank so accounts under the same
 * bank read as a group. Built on the shared `DivergingBarChart` shell (also
 * used by budget-vs-actual-chart.tsx) — a donut can't represent a negative
 * balance (an overdrawn account), this bar extends left of zero instead.
 * Unlike budget-vs-actual's tooltip, the balance's own sign is shown as-is
 * (default `formatTooltipValue`) rather than unsigned: here the sign *is*
 * the information (overdrawn or not), not redundant with a status label.
 */
export function AccountBalanceBreakdownChart({ groups, height = 280 }: AccountBalanceBreakdownChartProps) {
  const { t } = useLocale();

  const data = useMemo(
    () =>
      groups.flatMap((group) => {
        const bankLabel = group.bank ?? t("dashboard.noBank");
        const color = colorForBank(bankLabel);
        return group.accounts.map((account) => ({
          id: account.id,
          label: account.name,
          value: account.balanceCents,
          color,
          tooltipContext: bankLabel,
        }));
      }),
    [groups, t],
  );

  return <DivergingBarChart data={data} height={height} yAxisWidth={110} />;
}
