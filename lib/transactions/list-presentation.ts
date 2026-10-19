import type { useLocale } from "@/components/locale-provider";
import { formatEuros } from "@/lib/format";
import type { Transaction } from "@/lib/transactions/list-types";

export function transactionAmounts(t: ReturnType<typeof useLocale>["t"]) {
  const amountClass = (tx: Transaction) =>
    tx.transfer_id ? "text-blue-600 dark:text-blue-400" : tx.kind === "expense" ? "text-expense" : "text-income";
  // Issue 123 (ADR 0004): an expense with linked reimbursements shows its net.
  const isReimbursed = (tx: Transaction) => tx.kind === "expense" && (tx.reimbursed_cents ?? 0) > 0;
  const shownCents = (tx: Transaction) => (isReimbursed(tx) ? (tx.net_cents ?? 0) : Math.abs(tx.amount_cents));
  const amountText = (tx: Transaction) =>
    `${tx.transfer_id ? "" : tx.kind === "expense" ? "−" : "+"}${formatEuros(shownCents(tx), tx.currency)}`;
  const reimbursementNote = (tx: Transaction) =>
    isReimbursed(tx)
      ? t("transactions.reimbursements.netOf", {
          net: formatEuros(shownCents(tx), tx.currency),
          gross: formatEuros(Math.abs(tx.amount_cents), tx.currency),
        })
      : tx.reimburses_transaction_id
        ? t("transactions.reimbursements.linkedBadge")
        : null;

  return { amountClass, amountText, reimbursementNote };
}

export function transactionEditValues(transaction: Transaction) {
  const common = { amount: String(Math.abs(transaction.amount_cents) / 100), date: transaction.date.slice(0, 10), description: transaction.description, notes: transaction.notes ?? "" };
  return transaction.transfer_id
    ? { ...common, from_account_id: transaction.account_id, to_account_id: transaction.to_account?.id ?? "" }
    : { ...common, account_id: transaction.account_id, category_id: transaction.category_id ?? "" };
}
