import { DashboardCard } from "@/components/dashboard/dashboard-card";
import type { BankGroup } from "@/lib/accounts/group-account-balances";
import { formatEuros } from "@/lib/format";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from "@/lib/constants";

interface AccountBalancesProps {
  groups: BankGroup[];
}

/**
 * "Comptes par banque" widget — accounts grouped by `accounts.bank` (plan
 * §Étape 3), each group showing a subtotal. Complements the "Solde
 * consolidé" KPI (kpi-row.tsx) rather than replacing it: that tile answers
 * "where do I stand overall", this widget answers "where is the money".
 * Accounts with no bank set (existing accounts before this étape, or ones
 * the user leaves blank — the field is optional) land in a trailing "Sans
 * banque renseignée" group rather than being hidden.
 */
export function AccountBalances({ groups }: AccountBalancesProps) {
  if (groups.length === 0) return null;

  return (
    <DashboardCard>
      <h2 className="mb-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">Comptes par banque</h2>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {groups.map((group) => (
          <div key={group.bank ?? "__none__"} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                {group.bank ?? "Sans banque renseignée"}
              </h3>
              <span className="text-sm font-semibold">{formatEuros(group.totalCents)}</span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {group.accounts.map((account) => (
                <li key={account.id} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {account.name}
                    <span className="ml-1.5 text-xs text-zinc-400 dark:text-zinc-500">
                      · {ACCOUNT_TYPE_LABELS[account.type as (typeof ACCOUNT_TYPES)[number]] ?? account.type}
                    </span>
                  </span>
                  <span className={account.balanceCents < 0 ? "text-expense" : "text-zinc-700 dark:text-zinc-300"}>
                    {formatEuros(account.balanceCents)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
