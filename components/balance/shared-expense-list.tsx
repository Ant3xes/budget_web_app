"use client";

import { BalanceDeleteButton } from "@/components/balance/balance-delete-button";
import { useLocale } from "@/components/locale-provider";
import { Card } from "@/components/ui/card";
import { CATEGORY_COLOR_FALLBACK } from "@/lib/constants";
import { formatDate, formatEuros } from "@/lib/format";
import { resolveCategoryName } from "@/lib/i18n/category-name";

export type SharedExpenseItem = {
  id: string;
  paidBy: string;
  paidByName: string;
  amountCents: number;
  currency: string;
  date: string;
  description: string | null;
  myShareCents: number;
  category: {
    name: string;
    color: string | null;
    is_default: boolean | null;
    translation_key: string | null;
  } | null;
};

export function SharedExpenseList({
  expenses,
  currentUserId,
}: {
  expenses: SharedExpenseItem[];
  currentUserId: string;
}) {
  const { t } = useLocale();

  return (
    <Card className="p-4">
      <h2 className="text-lg font-medium">{t("balance.expenses.heading")}</h2>
      {expenses.length === 0 ? (
        <div className="mt-3 text-sm text-muted-foreground">
          <p>{t("balance.expenses.empty")}</p>
          <p className="mt-1">{t("balance.expenses.emptyHint")}</p>
        </div>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-2">
              <div className="min-w-0">
                <p className="truncate font-medium">{expense.description ?? "—"}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                  <span>{formatDate(expense.date)}</span>
                  <span>·</span>
                  <span>{t("balance.expenses.paidBy", { name: expense.paidByName })}</span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: expense.category?.color ?? CATEGORY_COLOR_FALLBACK }}
                      aria-hidden="true"
                    />
                    {expense.category
                      ? resolveCategoryName(expense.category, t)
                      : t("balance.expenses.uncategorized")}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-semibold">{formatEuros(expense.amountCents, expense.currency)}</span>
                <span className="text-xs text-muted-foreground">
                  {t("balance.expenses.yourShare", { amount: formatEuros(expense.myShareCents, expense.currency) })}
                </span>
                {expense.paidBy === currentUserId ? (
                  <BalanceDeleteButton
                    url={`/api/shared-expenses/${expense.id}`}
                    labelKey="balance.expenses.unshare"
                    confirmTitleKey="balance.expenses.unshareConfirmTitle"
                    confirmDescriptionKey="balance.expenses.unshareConfirmDescription"
                    errorKey="balance.expenses.error"
                    cancelKey="balance.expenses.cancel"
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
