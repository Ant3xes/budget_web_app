"use client";

import { BalanceDeleteButton } from "@/components/balance/balance-delete-button";
import { useLocale } from "@/components/locale-provider";
import { Card } from "@/components/ui/card";
import { formatDate, formatEuros } from "@/lib/format";

export type SettlementItem = {
  id: string;
  fromName: string;
  toName: string;
  amountCents: number;
  date: string;
  createdBy: string;
};

export function SettlementList({
  settlements,
  currentUserId,
}: {
  settlements: SettlementItem[];
  currentUserId: string;
}) {
  const { t } = useLocale();

  return (
    <Card className="p-4">
      <h2 className="text-lg font-medium">{t("balance.settlements.heading")}</h2>
      {settlements.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{t("balance.settlements.empty")}</p>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {settlements.map((settlement) => (
            <li
              key={settlement.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-2"
            >
              <div className="min-w-0">
                <p className="truncate">
                  {t("balance.settlements.line", {
                    from: settlement.fromName,
                    to: settlement.toName,
                    amount: formatEuros(settlement.amountCents),
                  })}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(settlement.date)}</p>
              </div>
              {settlement.createdBy === currentUserId ? (
                <BalanceDeleteButton
                  url={`/api/settlements/${settlement.id}`}
                  labelKey="balance.settlements.delete"
                  confirmTitleKey="balance.settlements.deleteConfirmTitle"
                  confirmDescriptionKey="balance.settlements.deleteConfirmDescription"
                  errorKey="balance.settlements.error"
                  cancelKey="balance.settlements.cancel"
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
