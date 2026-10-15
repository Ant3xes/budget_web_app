/**
 * Linked reimbursements (ADR 0004, issue 123): the single place where the
 * "net of an expense" rule lives. Every figure that sums expenses or incomes
 * goes through here; balances never do (the money really moved).
 *
 *   net = max(0, |expense| − sum(linked reimbursements))
 */

/** A reimbursement link as stored: `id` is the incoming transaction, it pays back `expenseId`. */
export type ReimbursementLink = { id: string; expenseId: string; amount_cents: number };

export type ReimbursementIndex = {
  /** expense id → total reimbursed (cents, positive) */
  byExpense: Map<string, number>;
  /** ids of the incoming transactions that reimburse an expense (no longer income) */
  linkedSourceIds: Set<string>;
};

export const EMPTY_REIMBURSEMENTS: ReimbursementIndex = {
  byExpense: new Map(),
  linkedSourceIds: new Set(),
};

/** Sum of reimbursement amounts (cents). Negative or zero amounts are ignored. */
export function sumReimbursements(amountsCents: readonly number[]): number {
  return amountsCents.reduce((sum, cents) => (cents > 0 ? sum + cents : sum), 0);
}

/** Net cost of an expense, capped at 0. `grossCents` may be signed (stored expenses are negative). */
export function netExpenseCents(grossCents: number, reimbursedCents: number): number {
  return Math.max(0, Math.abs(grossCents) - Math.max(0, reimbursedCents));
}

export function buildReimbursementIndex(links: readonly ReimbursementLink[]): ReimbursementIndex {
  const byExpense = new Map<string, number>();
  const linkedSourceIds = new Set<string>();
  for (const link of links) {
    if (link.amount_cents <= 0) continue;
    linkedSourceIds.add(link.id);
    byExpense.set(link.expenseId, (byExpense.get(link.expenseId) ?? 0) + link.amount_cents);
  }
  return { byExpense, linkedSourceIds };
}

type Row = { id: string; amount_cents: number };

/**
 * Display variant: keeps every row, replaces an expense's amount by its net
 * (sign preserved). Used by lists, where nothing is hidden.
 */
export function netAmounts<T extends Row>(rows: readonly T[], index: ReimbursementIndex): T[] {
  if (index.byExpense.size === 0) return [...rows];
  return rows.map((row) => {
    const reimbursed = index.byExpense.get(row.id);
    if (reimbursed === undefined) return row;
    const sign = row.amount_cents < 0 ? -1 : 1;
    const net = netExpenseCents(row.amount_cents, reimbursed);
    return { ...row, amount_cents: net === 0 ? 0 : sign * net };
  });
}

/**
 * Aggregation variant: expenses count for their net (fully reimbursed ones
 * disappear, so they do not inflate counts either) and reimbursements no longer
 * count as income. Feed the result to the `compute*` helpers and the sums.
 */
export function applyReimbursements<T extends Row>(rows: readonly T[], index: ReimbursementIndex): T[] {
  if (index.byExpense.size === 0) return [...rows];
  return netAmounts(
    rows.filter((row) => !index.linkedSourceIds.has(row.id)),
    index,
  ).filter((row) => row.amount_cents !== 0 || !index.byExpense.has(row.id));
}
