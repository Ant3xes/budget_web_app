// Explicit transfer choice in the import preview (issue 129). A transfer
// candidate is never guessed: the user picks "internal" (counterpart account
// required => transfer pair with mirror) or "external" (plain expense/income
// with a category). Import stays blocked while a row has no choice.

export type TransferChoice = { type: "internal"; accountId: string } | { type: "external" };

type TransferRow = { rowId: string; kind: "expense" | "income"; is_duplicate?: boolean };

export function isChoiceComplete(choice: TransferChoice | undefined, importAccountId: string): boolean {
  if (!choice) return false;
  if (choice.type === "external") return true;
  return !!choice.accountId && choice.accountId !== importAccountId;
}

/** Rows in transfer state, selected for import, still without a valid choice. */
export function pendingTransferRows<T extends TransferRow>(
  rows: T[],
  isTransfer: Record<string, boolean>,
  checked: Record<string, boolean>,
  choices: Record<string, TransferChoice | undefined>,
  importAccountId: string,
): T[] {
  return rows.filter(
    (r) =>
      !r.is_duplicate &&
      !!isTransfer[r.rowId] &&
      !!checked[r.rowId] &&
      !isChoiceComplete(choices[r.rowId], importAccountId),
  );
}

/** Bulk "mark all external" on the given rows (every row, checked or not). */
export function markAllExternal(
  choices: Record<string, TransferChoice | undefined>,
  rows: { rowId: string }[],
): Record<string, TransferChoice | undefined> {
  const next = { ...choices };
  for (const r of rows) next[r.rowId] = { type: "external" };
  return next;
}

/** Bulk "mark all internal to account X"; X may not be the import account. */
export function markAllInternal(
  choices: Record<string, TransferChoice | undefined>,
  rows: { rowId: string }[],
  accountId: string,
  importAccountId: string,
): Record<string, TransferChoice | undefined> {
  if (!accountId || accountId === importAccountId) return choices;
  const next = { ...choices };
  for (const r of rows) next[r.rowId] = { type: "internal", accountId };
  return next;
}

export type ConfirmKindFields = {
  kind: "expense" | "income" | "transfer";
  category_id: string | null;
  transfer_account_id?: string;
};

/**
 * Translates a row into the kind fields of /api/import/confirm. Rows that are
 * not in transfer state keep their kind and category. Throws on a transfer
 * row without a valid choice: callers must validate first.
 */
export function buildKindFields(
  row: { kind: "expense" | "income" },
  inTransferState: boolean,
  choice: TransferChoice | undefined,
  categoryId: string | null,
  importAccountId: string,
): ConfirmKindFields {
  if (!inTransferState) return { kind: row.kind, category_id: categoryId };
  if (!isChoiceComplete(choice, importAccountId)) throw new Error("Transfer choice missing");
  if (choice!.type === "internal") {
    return { kind: "transfer", category_id: null, transfer_account_id: choice!.accountId };
  }
  return { kind: row.kind, category_id: categoryId };
}
