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
 * tooltip, which assistive technology exposes as the link's description.
 *
 * The link deliberately has no `aria-label`: its accessible name comes from
 * its visible content (bank, total, account count), so the name always
 * contains the visible text (WCAG 2.5.3 "Label in Name", flagged by
 * Lighthouse's `label-content-name-mismatch`).
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
            className="block w-[80%] shrink-0 snap-start rounded-2xl sm:w-56 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <StatTile
              interactive
              label={bankLabel}
              value={formatEuros(group.totalCents)}
              valueClassName={group.totalCents < 0 ? "text-expense" : undefined}
              footer={
                <>
                  <p className="mt-1 text-xs text-muted-foreground">{countLabel}</p>
                  <ul className="mt-2 space-y-0.5 border-t border-border pt-2 text-xs text-muted-foreground sm:hidden">
                    {group.accounts.map((a) => (
                      <li key={a.id} className="flex justify-between gap-2">
                        <span className="truncate">{a.name}</span>
                        <span className="shrink-0 tabular-nums">{formatEuros(a.balanceCents)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              }
              className="h-full"
            />
          </Link>
        );
      })}
    </>
  );
}
