"use client";

import { useRouter } from "next/navigation";

import { buildDashboardHref } from "@/lib/dashboard/build-dashboard-href";
import { pillButtonClass } from "@/lib/dashboard/pill-class";

interface AccountOption {
  id: string;
  name: string;
}

interface AccountSelectorProps {
  /** Courant accounts only (plan §1.6 — the selector never lists other types). */
  accounts: AccountOption[];
  /** Currently selected courant account ids — the full list when nothing is filtered. */
  selectedIds: string[];
  basePath: string;
  /** Current `?period=` value, preserved when toggling an account. */
  periodParam?: string;
}

/**
 * Courant-accounts filter for the Dashboard (plan §1.5/§1.6) — every button
 * toggles independently (on by default, i.e. "all" is the no-`?accounts=`
 * state), "Tous les comptes" resets to that default rather than being a
 * toggle itself. Same pill styling and `?period=`-preserving URL pattern as
 * `period-selector.tsx`/`period-selector-custom.tsx`, via the shared
 * `buildDashboardHref` helper so toggling one filter never drops the other.
 */
export function AccountSelector({ accounts, selectedIds, basePath, periodParam }: AccountSelectorProps) {
  const router = useRouter();
  if (accounts.length === 0) return null;

  const selectedIdSet = new Set(selectedIds);
  const allSelected = selectedIds.length === accounts.length;

  const navigate = (accountsParam: string | undefined) => {
    router.push(buildDashboardHref(basePath, { period: periodParam, accounts: accountsParam }));
  };

  const toggleAccount = (id: string) => {
    const next = selectedIdSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id];
    // Covering every account again is the "reset" state — represented by
    // dropping `?accounts=` entirely rather than spelling out every id.
    navigate(next.length === accounts.length ? undefined : next.join(","));
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
      <button type="button" onClick={() => navigate(undefined)} className={pillButtonClass(allSelected)}>
        Tous les comptes
      </button>
      {accounts.map((account) => {
        const isSelected = selectedIdSet.has(account.id);
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => toggleAccount(account.id)}
            aria-pressed={isSelected}
            className={pillButtonClass(isSelected)}
          >
            {account.name}
          </button>
        );
      })}
    </div>
  );
}
