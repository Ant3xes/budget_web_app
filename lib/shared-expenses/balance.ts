import { owedCents, type Shares } from "@/lib/shared-expenses/split-shares";

export type SharedExpenseLike = { paid_by: string; amount_cents: number; shares: Shares };
export type SettlementLike = { from_user: string; to_user: string; amount_cents: number };
export type Transfer = { from: string; to: string; amount_cents: number };

/**
 * Net position of each member, in cents. Positive: the others owe them that
 * much. Negative: they owe that much. The values always sum to zero.
 *
 * - For each shared expense every non-payer owes their share to the payer.
 * - A settlement ("from paid to") moves `amount` from the debtor's debt to the
 *   creditor's credit.
 *
 * Members with no expense or settlement are absent; callers add them at 0.
 */
export const computeBalances = (
  expenses: SharedExpenseLike[],
  settlements: SettlementLike[],
): Record<string, number> => {
  const net: Record<string, number> = {};
  const add = (userId: string, cents: number) => {
    net[userId] = (net[userId] ?? 0) + cents;
  };

  for (const expense of expenses) {
    // The payer bears whatever the others do not, so rounding never leaks cents.
    for (const [userId, percent] of Object.entries(expense.shares)) {
      if (userId === expense.paid_by) continue;
      const owed = owedCents(expense.amount_cents, percent);
      add(userId, -owed);
      add(expense.paid_by, owed);
    }
  }

  for (const settlement of settlements) {
    add(settlement.from_user, settlement.amount_cents);
    add(settlement.to_user, -settlement.amount_cents);
  }

  return net;
};

/**
 * Fewest-transfers-style suggestion to bring everybody back to zero: the
 * largest debtor pays the largest creditor, repeated. With two members this is
 * simply "X pays Y".
 */
export const suggestTransfers = (balances: Record<string, number>): Transfer[] => {
  const debtors = Object.entries(balances)
    .filter(([, cents]) => cents < 0)
    .map(([id, cents]) => ({ id, cents: -cents }))
    .sort((a, b) => b.cents - a.cents);
  const creditors = Object.entries(balances)
    .filter(([, cents]) => cents > 0)
    .map(([id, cents]) => ({ id, cents }))
    .sort((a, b) => b.cents - a.cents);

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].cents, creditors[c].cents);
    if (amount > 0) {
      transfers.push({ from: debtors[d].id, to: creditors[c].id, amount_cents: amount });
    }
    debtors[d].cents -= amount;
    creditors[c].cents -= amount;
    if (debtors[d].cents === 0) d += 1;
    if (creditors[c].cents === 0) c += 1;
  }

  return transfers;
};
