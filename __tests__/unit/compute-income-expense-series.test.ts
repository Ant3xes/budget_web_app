import { describe, expect, it } from "vitest";

import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";

describe("computeIncomeExpenseSeries", () => {
  it("returns monthCount zeroed months when there are no transactions", () => {
    const now = new Date(2026, 6, 15); // July 2026
    const series = computeIncomeExpenseSeries([], 6, now);

    expect(series).toHaveLength(6);
    expect(series.every((p) => p.income === 0 && p.expense === 0)).toBe(true);
    expect(series[0].month).toBe("Fév 26");
    expect(series[5].month).toBe("Juil 26");
  });

  it("aggregates income and expense by month and ignores transfers", () => {
    const now = new Date(2026, 2, 10); // March 2026
    const series = computeIncomeExpenseSeries(
      [
        { date: "2026-01-10", kind: "income", amount_cents: 200_000 },
        { date: "2026-01-15", kind: "expense", amount_cents: -5_000 },
        { date: "2026-01-20", kind: "expense", amount_cents: -3_000 },
        { date: "2026-02-01", kind: "income", amount_cents: 150_000 },
        { date: "2026-02-05", kind: "transfer_debit", amount_cents: -10_000 },
        { date: "2026-03-01", kind: "expense", amount_cents: -8_000 },
        { date: "2025-12-01", kind: "expense", amount_cents: -99_000 }, // outside window
      ],
      3,
      now,
    );

    expect(series).toHaveLength(3);
    expect(series[0]).toEqual({ key: "2026-01", month: "Jan 26", income: 200_000, expense: 8_000 });
    expect(series[1]).toEqual({ key: "2026-02", month: "Fév 26", income: 150_000, expense: 0 });
    expect(series[2]).toEqual({ key: "2026-03", month: "Mar 26", income: 0, expense: 8_000 });
  });

  it("with null monthCount covers from earliest tx through now", () => {
    const now = new Date(2026, 2, 10); // March 2026
    const series = computeIncomeExpenseSeries(
      [
        { date: "2025-12-01", kind: "expense", amount_cents: -1_000 },
        { date: "2026-03-01", kind: "income", amount_cents: 5_000 },
      ],
      null,
      now,
    );

    expect(series).toHaveLength(4); // Dec → Mar
    expect(series[0]).toEqual({ key: "2025-12", month: "Déc 25", income: 0, expense: 1_000 });
    expect(series[3]).toEqual({ key: "2026-03", month: "Mar 26", income: 5_000, expense: 0 });
  });
});
