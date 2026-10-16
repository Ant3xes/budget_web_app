/**
 * Pure planning of a transaction type change (issue 115).
 *
 * The planner decides, from the row as stored and the values submitted by the
 * modal, what the edited row becomes and whether a mirror line must exist. The
 * SQL function `convert_transaction` applies that plan atomically; keeping the
 * decision here makes the sign / kind / mirror rules unit-testable.
 */

export type UiKind = "expense" | "income" | "transfer";
export type DbKind = "expense" | "income" | "transfer_debit" | "transfer_credit";

export type ConversionInput = {
  /** Kind of the row being edited, as stored. */
  currentKind: DbKind;
  /** Type selected in the modal. */
  targetKind: UiKind;
  /** Absolute amount in cents (> 0). */
  amountCents: number;
  /** Account of the edited row for expense/income targets. */
  accountId: string;
  /** Transfer targets only: money leaves `fromAccountId` and lands on `toAccountId`. */
  fromAccountId?: string | null;
  toAccountId?: string | null;
  /** Expense/income targets only. */
  categoryId?: string | null;
};

export type MirrorPlan = { kind: "transfer_debit" | "transfer_credit"; accountId: string; amountCents: number };

export type ConversionPlan = {
  kind: DbKind;
  accountId: string;
  amountCents: number;
  categoryId: string | null;
  /** True when the edited row belongs to a transfer after the change. */
  isTransfer: boolean;
  /** Mirror line to (re)create; null when the target is not a transfer. */
  mirror: MirrorPlan | null;
  /** True when an existing mirror line must be soft-deleted first. */
  dropExistingMirror: boolean;
};

export class ConversionError extends Error {}

export function isTransferKind(kind: DbKind): boolean {
  return kind === "transfer_debit" || kind === "transfer_credit";
}

/** UI-level type of a stored kind: both transfer sides read "transfer". */
export function uiKindOf(kind: DbKind): UiKind {
  return kind === "transfer_debit" || kind === "transfer_credit" ? "transfer" : kind;
}

/**
 * The edited row keeps its side of the money flow when it becomes (or stays)
 * a transfer: an outgoing line (expense, debit) is the debit side, an incoming
 * one (income, credit) the credit side.
 */
function isOutgoing(kind: DbKind): boolean {
  return kind === "expense" || kind === "transfer_debit";
}

export function planConversion(input: ConversionInput): ConversionPlan {
  const amount = Math.abs(input.amountCents);
  if (!Number.isInteger(amount) || amount === 0) throw new ConversionError("Montant invalide");
  const dropExistingMirror = isTransferKind(input.currentKind);

  if (input.targetKind === "transfer") {
    const from = input.fromAccountId;
    const to = input.toAccountId;
    if (!from || !to) throw new ConversionError("Compte source et destination requis");
    if (from === to) throw new ConversionError("Les comptes source et destination doivent être différents");
    const outgoing = isOutgoing(input.currentKind);
    return {
      kind: outgoing ? "transfer_debit" : "transfer_credit",
      accountId: outgoing ? from : to,
      amountCents: outgoing ? -amount : amount,
      categoryId: null,
      isTransfer: true,
      mirror: outgoing
        ? { kind: "transfer_credit", accountId: to, amountCents: amount }
        : { kind: "transfer_debit", accountId: from, amountCents: -amount },
      dropExistingMirror,
    };
  }

  // A transfer has no category: leaving one must pick a category explicitly.
  if (dropExistingMirror && !input.categoryId) throw new ConversionError("Catégorie requise");
  return {
    kind: input.targetKind,
    accountId: input.accountId,
    amountCents: input.targetKind === "expense" ? -amount : amount,
    categoryId: input.categoryId ?? null,
    isTransfer: false,
    mirror: null,
    dropExistingMirror,
  };
}
