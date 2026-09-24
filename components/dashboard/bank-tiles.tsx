"use client";

import Link from "next/link";

import { useLocale } from "@/components/locale-provider";
import { StatTile } from "@/components/ui/stat-tile";
import { NO_BANK_PARAM } from "@/lib/accounts/bank-param";
import type { BankGroup } from "@/lib/accounts/group-account-balances";
import { formatEuros } from "@/lib/format";

interface BankTilesProps {
  groups: BankGroup[];
}

/**
 * One tile per bank, next to the consolidated balance — deliberately the
 * same `StatTile` format (label, semibold value, muted footer, same width)
 * so the row reads as one continuous set. Each tile links to that bank's
 * tab on /accounts (`?bank=`). The per-account detail lives in the `title`
 * tooltip and, for keyboard/screen-reader users, in the link's accessible
 * label.
 */
export function BankTiles({ groups }: BankTilesProps) {
  const { t } = useLocale();
  if (groups.length === 0) return null;

  return (
    <>
      {groups.map((group) => {
        const bankLabel = group.bank ?? t("dashboard.noBank");
        const accountsDetail = group.accounts.map((a) => `${a.name}: ${formatEuros(a.balanceCents)}`).join(", ");
        const count = group.accounts.length;
        const countLabel = t(count === 1 ? "dashboard.bankAccountsSingular" : "dashboard.bankAccountsPlural", { count });
        return (
          <Link
            key={group.bank ?? NO_BANK_PARAM}
            href={`/accounts?bank=${encodeURIComponent(group.bank ?? NO_BANK_PARAM)}`}
            title={accountsDetail}
            aria-label={`${bankLabel} — ${formatEuros(group.totalCents)} (${accountsDetail})`}
            className="block w-56 shrink-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <StatTile
              interactive
              label={bankLabel}
              value={formatEuros(group.totalCents)}
              valueClassName={group.totalCents < 0 ? "text-expense" : undefined}
              footer={<p className="mt-1 text-xs text-muted-foreground">{countLabel}</p>}
              className="h-full"
            />
          </Link>
        );
      })}
    </>
  );
}
