/** userId -> percent of an expense that member bears. Sums to exactly 100. */
export type Shares = Record<string, number>;

const roundTo2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Builds the split stored on a shared expense: the payer bears
 * `payerSharePercent`, the rest is divided equally among the other members.
 * The last member absorbs rounding so the total is exactly 100 (the database
 * refuses anything else).
 */
export const splitShares = (payerId: string, memberIds: string[], payerSharePercent: number): Shares => {
  if (!memberIds.includes(payerId)) {
    throw new Error("The payer must be a member of the space.");
  }
  if (!Number.isFinite(payerSharePercent) || payerSharePercent < 0 || payerSharePercent > 100) {
    throw new Error("The payer share must be between 0 and 100.");
  }

  const others = memberIds.filter((id) => id !== payerId);
  if (others.length === 0) {
    return { [payerId]: 100 };
  }

  const payerShare = roundTo2(payerSharePercent);
  const each = roundTo2((100 - payerShare) / others.length);
  const shares: Shares = { [payerId]: payerShare };
  let assigned = payerShare;

  others.forEach((id, index) => {
    const isLast = index === others.length - 1;
    const share = isLast ? roundTo2(100 - assigned) : each;
    shares[id] = share;
    assigned = roundTo2(assigned + share);
  });

  return shares;
};

/** Amount (in cents) a member bears for an expense, rounded to the nearest cent. */
export const owedCents = (amountCents: number, sharePercent: number) => Math.round((amountCents * sharePercent) / 100);
