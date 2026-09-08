"use client";

import { useLocale } from "@/components/locale-provider";
import { colorForBank } from "@/lib/accounts/color-for-bank";
import type { BankGroup } from "@/lib/accounts/group-account-balances";
import { formatEuros } from "@/lib/format";

interface BankBubblesProps {
  groups: BankGroup[];
}

/**
 * Replaces the former "Comptes par banque" widget (account-balances.tsx, now
 * removed) — instead of a full list-with-subtotal block lower on the page,
 * one compact bubble per bank sits right next to the consolidated balance
 * tile. Purely informative: clicking a bubble does nothing — filtering by
 * account stays the `AccountSelector`'s job, positioned right below.
 *
 * Every bubble is a fixed-size circle (`w-24 h-24`) regardless of how many
 * accounts the bank groups, ringed in a color hashed from the bank's name
 * (`colorForBank`, shared with `AccountBalanceBreakdownChart` so a bank
 * reads as the same color in both views) so the eye can tell banks apart at
 * a glance. This revises the layout from issue #35, which gave a bank with
 * more than one account a second line listing each account's own balance
 * directly in the bubble — that no longer fits a fixed circle, so the
 * detail moved into the `title` tooltip (mouse-hover only) *and* into a
 * screen-reader-only paragraph rendered right after the grid, so the same
 * per-account detail stays reachable without a mouse. The parent panel
 * (`app/(app)/dashboard/page.tsx`'s "accounts overview" section) is what
 * now visually reads as the single enclosing "big bubble" holding
 * everything, so this component only renders the row of small circles
 * itself — wrapping them in a second background/padding here as well would
 * just nest two soft gray panels inside each other.
 */
export function BankBubbles({ groups }: BankBubblesProps) {
  const { t } = useLocale();
  if (groups.length === 0) return null;

  // Computed once per group, reused by both the visual bubble (title
  // tooltip included) and the sr-only paragraph below, instead of each
  // re-deriving `bankLabel`/`accountsDetail` from `group` independently.
  const bubbles = groups.map((group) => {
    const bankLabel = group.bank ?? t("dashboard.noBank");
    const accountsDetail = group.accounts.map((a) => `${a.name}: ${formatEuros(a.balanceCents)}`).join(", ");
    return { key: group.bank ?? "__none__", bankLabel, accountsDetail, totalCents: group.totalCents, ringColor: colorForBank(bankLabel) };
  });

  return (
    <>
      <div className="flex flex-wrap items-start gap-3">
        {bubbles.map((bubble) => (
          <div
            key={bubble.key}
            tabIndex={0}
            className="flex h-24 w-24 shrink-0 flex-col items-center justify-center gap-0.5 rounded-full border-2 bg-white px-2 text-center dark:bg-zinc-900"
            style={{ borderColor: bubble.ringColor }}
            title={bubble.accountsDetail}
          >
            <span className="w-full truncate text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
              {bubble.bankLabel}
            </span>
            <span
              className={`w-full truncate text-xs ${bubble.totalCents < 0 ? "text-expense" : "text-zinc-600 dark:text-zinc-400"}`}
            >
              {formatEuros(bubble.totalCents)}
            </span>
          </div>
        ))}
      </div>
      {/* Keyboard/touch/screen-reader equivalent of the `title` tooltips
          above (native tooltips are mouse-hover-only) — same per-account
          detail, always in the accessibility tree even though visually
          hidden. */}
      <p className="sr-only">
        {bubbles.map((bubble) => `${bubble.bankLabel} — ${formatEuros(bubble.totalCents)} (${bubble.accountsDetail})`).join(". ")}
      </p>
    </>
  );
}
