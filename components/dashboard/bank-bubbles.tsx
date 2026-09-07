"use client";

import { useLocale } from "@/components/locale-provider";
import type { BankGroup } from "@/lib/accounts/group-account-balances";
import { formatEuros } from "@/lib/format";

interface BankBubblesProps {
  groups: BankGroup[];
}

/**
 * Replaces the former "Comptes par banque" widget (account-balances.tsx,
 * now removed) — instead of a full list-with-subtotal block lower on the
 * page, one compact pill per bank sits right next to the consolidated
 * balance tile. Purely informative (per the plan's AskUserQuestion answer):
 * clicking a bubble does nothing — filtering by account stays the
 * `AccountSelector`'s job, positioned right below these bubbles. Same pill
 * visual language as `AccountSelector`/`PeriodSelector`, just non-interactive
 * (`<span>`, not `<button>`).
 */
export function BankBubbles({ groups }: BankBubblesProps) {
  const { t } = useLocale();
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {groups.map((group) => (
        <span
          key={group.bank ?? "__none__"}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          title={group.accounts.map((a) => a.name).join(", ")}
        >
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{group.bank ?? t("dashboard.noBank")}</span>
          <span className="text-zinc-400 dark:text-zinc-500">·</span>
          <span className={group.totalCents < 0 ? "text-expense" : "text-zinc-600 dark:text-zinc-400"}>
            {formatEuros(group.totalCents)}
          </span>
        </span>
      ))}
    </div>
  );
}
