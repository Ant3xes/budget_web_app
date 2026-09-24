import { describe, expect, it } from "vitest";

import { computeBalances, suggestTransfers } from "@/lib/shared-expenses/balance";
import { owedCents, splitShares } from "@/lib/shared-expenses/split-shares";

const ROMAIN = "romain";
const ELLE = "elle";
const THIRD = "third";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

describe("splitShares", () => {
  it("splits 50/50 between two members", () => {
    expect(splitShares(ROMAIN, [ROMAIN, ELLE], 50)).toEqual({ [ROMAIN]: 50, [ELLE]: 50 });
  });

  it("gives the payer their share and the rest to the other", () => {
    expect(splitShares(ELLE, [ROMAIN, ELLE], 60)).toEqual({ [ELLE]: 60, [ROMAIN]: 40 });
  });

  it("divides the remainder equally among the other members and sums to exactly 100", () => {
    const shares = splitShares(ROMAIN, [ROMAIN, ELLE, THIRD], 50);
    expect(shares).toEqual({ [ROMAIN]: 50, [ELLE]: 25, [THIRD]: 25 });

    const uneven = splitShares(ROMAIN, [ROMAIN, ELLE, THIRD, "d"], 40);
    expect(sum(Object.values(uneven))).toBe(100);
  });

  it("absorbs rounding in the last member (33.33 / 33.33 / 33.34)", () => {
    const shares = splitShares(ROMAIN, [ROMAIN, ELLE, THIRD], 33.33);
    expect(sum(Object.values(shares))).toBeCloseTo(100, 10);
    expect(shares[ROMAIN]).toBe(33.33);
  });

  it("keeps everything with a lone member", () => {
    expect(splitShares(ROMAIN, [ROMAIN], 50)).toEqual({ [ROMAIN]: 100 });
  });

  it("handles the 0 and 100 extremes", () => {
    expect(splitShares(ROMAIN, [ROMAIN, ELLE], 100)).toEqual({ [ROMAIN]: 100, [ELLE]: 0 });
    expect(splitShares(ROMAIN, [ROMAIN, ELLE], 0)).toEqual({ [ROMAIN]: 0, [ELLE]: 100 });
  });

  it("rejects a payer outside the space and out-of-range shares", () => {
    expect(() => splitShares("stranger", [ROMAIN, ELLE], 50)).toThrow();
    expect(() => splitShares(ROMAIN, [ROMAIN, ELLE], 101)).toThrow();
    expect(() => splitShares(ROMAIN, [ROMAIN, ELLE], -1)).toThrow();
    expect(() => splitShares(ROMAIN, [ROMAIN, ELLE], Number.NaN)).toThrow();
  });
});

describe("owedCents", () => {
  it("rounds to the nearest cent", () => {
    expect(owedCents(1000, 50)).toBe(500);
    expect(owedCents(1001, 50)).toBe(501);
    expect(owedCents(100, 33.33)).toBe(33);
  });
});

describe("computeBalances — the couple's case", () => {
  // Romain pays rent 850 €, internet 30 €, home insurance 25 €, car insurance 60 €;
  // she pays electricity 90 €. Everything 50/50 => he paid 965 €, she 90 €.
  const half = { [ROMAIN]: 50, [ELLE]: 50 };
  const expenses = [
    { paid_by: ROMAIN, amount_cents: 85000, shares: half },
    { paid_by: ROMAIN, amount_cents: 3000, shares: half },
    { paid_by: ROMAIN, amount_cents: 2500, shares: half },
    { paid_by: ROMAIN, amount_cents: 6000, shares: half },
    { paid_by: ELLE, amount_cents: 9000, shares: half },
  ];

  it("she owes him half of the net: (965 - 90) / 2 = 437.50 €", () => {
    const balances = computeBalances(expenses, []);
    expect(balances[ROMAIN]).toBe(43750);
    expect(balances[ELLE]).toBe(-43750);
    expect(sum(Object.values(balances))).toBe(0);
  });

  it("suggests a single transfer from her to him", () => {
    expect(suggestTransfers(computeBalances(expenses, []))).toEqual([
      { from: ELLE, to: ROMAIN, amount_cents: 43750 },
    ]);
  });

  it("a settlement reduces what she owes, down to zero", () => {
    const partial = computeBalances(expenses, [{ from_user: ELLE, to_user: ROMAIN, amount_cents: 20000 }]);
    expect(partial[ELLE]).toBe(-23750);
    expect(partial[ROMAIN]).toBe(23750);

    const settled = computeBalances(expenses, [{ from_user: ELLE, to_user: ROMAIN, amount_cents: 43750 }]);
    expect(settled[ELLE]).toBe(0);
    expect(settled[ROMAIN]).toBe(0);
    expect(suggestTransfers(settled)).toEqual([]);
  });

  it("an over-payment flips the direction", () => {
    const flipped = computeBalances(expenses, [{ from_user: ELLE, to_user: ROMAIN, amount_cents: 50000 }]);
    expect(flipped[ELLE]).toBe(6250);
    expect(suggestTransfers(flipped)).toEqual([{ from: ROMAIN, to: ELLE, amount_cents: 6250 }]);
  });
});

describe("computeBalances — other splits", () => {
  it("honours a frozen 60/40 split independently of the current default", () => {
    const balances = computeBalances(
      [{ paid_by: ROMAIN, amount_cents: 10000, shares: { [ROMAIN]: 60, [ELLE]: 40 } }],
      [],
    );
    expect(balances[ELLE]).toBe(-4000);
    expect(balances[ROMAIN]).toBe(4000);
  });

  it("never leaks a cent on odd amounts", () => {
    const balances = computeBalances(
      [{ paid_by: ROMAIN, amount_cents: 1001, shares: { [ROMAIN]: 50, [ELLE]: 50 } }],
      [],
    );
    expect(sum(Object.values(balances))).toBe(0);
  });

  it("is empty with nothing shared", () => {
    expect(computeBalances([], [])).toEqual({});
    expect(suggestTransfers({})).toEqual([]);
  });

  it("works with three members: two debtors pay the one who advanced everything", () => {
    const shares = { [ROMAIN]: 40, [ELLE]: 30, [THIRD]: 30 };
    const balances = computeBalances([{ paid_by: ROMAIN, amount_cents: 10000, shares }], []);

    expect(balances).toEqual({ [ELLE]: -3000, [THIRD]: -3000, [ROMAIN]: 6000 });
    const transfers = suggestTransfers(balances);
    expect(transfers).toHaveLength(2);
    expect(transfers.every((transfer) => transfer.to === ROMAIN)).toBe(true);
    expect(sum(transfers.map((transfer) => transfer.amount_cents))).toBe(6000);
  });
});
