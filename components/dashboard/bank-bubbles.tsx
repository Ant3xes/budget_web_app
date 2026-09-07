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
 * page, one compact card per bank sits right next to the consolidated
 * balance tile. Purely informative (per the plan's AskUserQuestion answer):
 * clicking a bubble does nothing — filtering by account stays the
 * `AccountSelector`'s job, positioned right below these bubbles.
 *
 * A bank with more than one account also lists each account's own balance
 * on a smaller second line (issue #35 — the bank total used to be the only
 * thing visible, individual accounts only reachable via this `title`
 * tooltip, which is now a redundant fallback for that case rather than the
 * only way to see them). A single-account bank skips that second line
 * (repeating the one account under its own bank subtotal would just say the
 * same number twice) and so keeps the plain one-line look — still a
 * non-interactive `<div>`, just no longer `rounded-full`: a genuine pill
 * doesn't accommodate a second line gracefully once one is needed.
 */
export function BankBubbles({ groups }: BankBubblesProps) {
  const { t } = useLocale();
  if (groups.length === 0) return null;

  return (
    <div className="flex flex-wrap items-start gap-2">
      {groups.map((group) => (
        <div
          key={group.bank ?? "__none__"}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs dark:border-zinc-700 dark:bg-zinc-900"
          title={group.accounts.map((a) => a.name).join(", ")}
        >
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">{group.bank ?? t("dashboard.noBank")}</span>
            <span className="text-zinc-400 dark:text-zinc-500">·</span>
            <span className={group.totalCents < 0 ? "text-expense" : "text-zinc-600 dark:text-zinc-400"}>
              {formatEuros(group.totalCents)}
            </span>
          </div>
          {group.accounts.length > 1 && (
            <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
              {group.accounts.map((account) => (
                <span key={account.id}>
                  {account.name}: {formatEuros(account.balanceCents)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
