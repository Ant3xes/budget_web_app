"use client";

import { useLocale } from "@/components/locale-provider";
import { Card } from "@/components/ui/card";
import type { BalanceMember, BalanceTransfer } from "@/components/balance/types";
import { formatEuros } from "@/lib/format";

/**
 * "Who owes what": the suggested transfers as sentences from the current
 * user's point of view, plus each member's net position when there are more
 * than two members (with two, the single sentence says it all).
 */
export function BalanceCard({
  members,
  balances,
  transfers,
  currentUserId,
}: {
  members: BalanceMember[];
  balances: Record<string, number>;
  transfers: BalanceTransfer[];
  currentUserId: string;
}) {
  const { t } = useLocale();
  const nameOf = (userId: string) => members.find((member) => member.userId === userId)?.name ?? "?";

  const sentence = (transfer: BalanceTransfer) => {
    const amount = formatEuros(transfer.amount_cents);
    if (transfer.from === currentUserId) {
      return t("balance.card.youOwe", { amount, name: nameOf(transfer.to) });
    }
    if (transfer.to === currentUserId) {
      return t("balance.card.owesYou", { amount, name: nameOf(transfer.from) });
    }
    return t("balance.card.owes", { amount, from: nameOf(transfer.from), to: nameOf(transfer.to) });
  };

  return (
    <Card className="p-4">
      <h2 className="text-lg font-medium">{t("balance.card.heading")}</h2>

      {transfers.length === 0 ? (
        <p className="mt-2 text-xl font-semibold text-status-good">{t("balance.card.settled")}</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {transfers.map((transfer) => (
            <li key={`${transfer.from}-${transfer.to}`} className="text-xl font-semibold">
              {sentence(transfer)}
            </li>
          ))}
        </ul>
      )}

      {members.length > 2 ? (
        <div className="mt-4 border-t border-border pt-3">
          <h3 className="text-sm font-medium text-muted-foreground">{t("balance.card.membersHeading")}</h3>
          <ul className="mt-2 space-y-1 text-sm">
            {members.map((member) => {
              const cents = balances[member.userId] ?? 0;
              return (
                <li key={member.userId} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {member.name}
                    {member.userId === currentUserId ? (
                      <span className="ml-1 text-muted-foreground">({t("balance.card.you")})</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {cents === 0
                      ? t("balance.card.even")
                      : cents > 0
                        ? t("balance.card.isOwed", { amount: formatEuros(cents) })
                        : t("balance.card.owesTotal", { amount: formatEuros(-cents) })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}
