"use client";

import { useRouter } from "next/navigation";

import { useLocale } from "@/components/locale-provider";
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
 * Courant-accounts filter for the Dashboard — strict single-selection: each
 * account button, whatever the current state, replaces the whole selection
 * with just that one account (no multi-account toggle-combining). "Tous les
 * comptes" stays the only control that clears the filter back to every
 * courant account, represented by dropping `?accounts=` entirely rather than
 * spelling out every id. Clicking the account that's already the sole
 * selection just re-navigates to the same URL — a harmless no-op. Same pill
 * styling and `?period=`-preserving URL pattern as
 * `period-selector.tsx`/`period-selector-custom.tsx`, via the shared
 * `buildDashboardHref` helper so switching one filter never drops the other.
 */
export function AccountSelector({ accounts, selectedIds, basePath, periodParam }: AccountSelectorProps) {
  const router = useRouter();
  const { t } = useLocale();
  if (accounts.length === 0) return null;

  // A URL built by this component always encodes "all" (no `?accounts=`) or
  // exactly one id — but `?accounts=` is a plain query param a stale
  // bookmark/shared link from before this component went single-select can
  // still carry 2+ comma-separated ids. Guarding on `selectedIds.length ===
  // 1` (rather than just `.has(id)`) keeps that legacy multi-id URL from
  // rendering more than one pill as pressed, which would contradict the
  // single-selection UI this component otherwise always presents.
  const selectedIdSet = selectedIds.length === 1 ? new Set(selectedIds) : new Set<string>();
  // Only used to style the "Tous les comptes" button as active — selection
  // is otherwise always either "all" or exactly one account.
  const allSelected = selectedIds.length === accounts.length;

  const navigate = (accountsParam: string | undefined) => {
    router.push(buildDashboardHref(basePath, { period: periodParam, accounts: accountsParam }));
  };

  // Always replaces the selection with just this one account, regardless of
  // what was selected before (all accounts, or a different single account).
  const selectAccount = (id: string) => {
    navigate(id);
  };

  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
      <button type="button" onClick={() => navigate(undefined)} className={pillButtonClass(allSelected)}>
        {t("dashboard.allAccounts")}
      </button>
      {/* Separates "Tous les comptes" (a reset control) from the individual
          account toggles below — same divider period-selector.tsx uses
          before its "Personnalisé" block. */}
      <div aria-hidden className="mx-1 w-px self-stretch bg-zinc-200 dark:bg-zinc-700" />
      {accounts.map((account) => {
        const isSelected = selectedIdSet.has(account.id);
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => selectAccount(account.id)}
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
