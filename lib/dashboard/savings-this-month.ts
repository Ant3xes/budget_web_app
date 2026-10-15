/**
 * Nets signed movements on non-courant accounts, including every transaction kind.
 * Rows must already be scoped to active accounts, non-deleted transactions and
 * the real current month by the dashboard query (independent of its filters).
 */
export function computeSavingsThisMonthCents(
  transactions: readonly { amount_cents: number }[],
): number {
  return transactions.reduce((sum, tx) => sum + tx.amount_cents, 0);
}
