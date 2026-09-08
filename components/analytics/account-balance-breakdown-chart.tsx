"use client";

import { useMemo } from "react";

import { DivergingBarChart } from "@/components/analytics/diverging-bar-chart";
import { useLocale } from "@/components/locale-provider";
import type { BankGroup } from "@/lib/accounts/group-account-balances";

interface AccountBalanceBreakdownChartProps {
  groups: BankGroup[];
  height?: number;
}

// Fixed categorical order (dataviz skill: assign hues in fixed order, never
// cycled per-render).
const BANK_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)",
];

/**
 * Deterministic slot from the bank's own name rather than its position in
 * `groups` — `groupAccountBalancesByBank` sorts alphabetically, so adding
 * or removing an unrelated bank would otherwise shift every alphabetically
 * later bank to a different array index, changing its color even though
 * that bank itself hasn't changed. A simple string hash trades a small,
 * bounded chance of two bank names sharing a slot (already possible once
 * there are more than 8 banks, index-cycling had the same ceiling) for a
 * color that stays fixed for a given bank across page loads.
 */
function colorForBank(bankLabel: string): string {
  let hash = 0;
  for (let i = 0; i < bankLabel.length; i++) hash = (hash * 31 + bankLabel.charCodeAt(i)) | 0;
  return BANK_COLORS[Math.abs(hash) % BANK_COLORS.length]!;
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
