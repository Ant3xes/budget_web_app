"use client";

import { BudgetBar } from "@/components/dashboard/budget-bar";
import { useLocale } from "@/components/locale-provider";
import { formatEuros } from "@/lib/format";

interface FixedChargesShareStatProps {
  /** Sum of courant-account balances (same figure the dashboard's "Reste à vivre" uses). */
  courantBalanceCents: number;
  /** Active fixed charges due through the end of the current month. */
  upcomingFixedChargesCents: number;
}

/**
 * "Part du reste-à-vivre absorbée par les charges fixes" (issue #36) — a
 * single derived percentage, not a chart (dataviz skill's form heuristic:
 * one number *is* the answer here — a bar makes the magnitude legible, a
 * full chart wouldn't add anything). Reuses `BudgetBar` for the meter
 * itself (same "ratio against a limit" shape as budget consumption) rather
 * than re-deriving its 4-tier spending-rhythm thresholds by hand. The big
 * percentage figure stays plain text color — dataviz skill: "text wears
 * text tokens, never the series color" — the bar alone carries the status.
 */
export function FixedChargesShareStat({ courantBalanceCents, upcomingFixedChargesCents }: FixedChargesShareStatProps) {
  const { t } = useLocale();

  if (courantBalanceCents <= 0) {
    return <p className="text-sm text-zinc-500">{t("analytics.fixedChargesShare.noBalance")}</p>;
  }

  const ratio = upcomingFixedChargesCents / courantBalanceCents;
  const pct = Math.round(ratio * 100);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-zinc-800 dark:text-zinc-100">{pct}%</span>
        <span className="text-sm text-zinc-500">
          {formatEuros(upcomingFixedChargesCents)} / {formatEuros(courantBalanceCents)}
        </span>
      </div>
      <BudgetBar ratio={ratio} className="mt-2" />
      <p className="mt-2 text-xs text-zinc-400">{t("analytics.fixedChargesShare.caption")}</p>
    </div>
  );
}
