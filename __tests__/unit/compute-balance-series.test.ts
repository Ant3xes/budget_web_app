import { describe, expect, it } from "vitest";

import { computeBalanceSeries } from "@/lib/accounts/compute-balance-series";

describe("computeBalanceSeries", () => {
  it("returns a single point with initial balance when there are no transactions", () => {
    const now = new Date(2026, 6, 15); // July 2026
    const series = computeBalanceSeries([], 50_000, now);
    expect(series).toHaveLength(1);
    expect(series[0].balance).toBe(50_000);
    expect(series[0].month).toMatch(/juil/i);
  });

  it("computes end-of-month balances from earliest tx through now", () => {
    const now = new Date(2026, 2, 10); // March 2026
    const series = computeBalanceSeries(
      [
        { date: "2026-01-15", amount_cents: -1000 },
        { date: "2026-02-01", amount_cents: 5000 },
        { date: "2026-03-05", amount_cents: -500 },
      ],
      10_000,
      now,
    );

    expect(series).toHaveLength(3);
    // Jan: 10000 - 1000 = 9000
    expect(series[0].balance).toBe(9000);
    // Feb: 10000 - 1000 + 5000 = 14000
    expect(series[1].balance).toBe(14000);
    // Mar: 10000 - 1000 + 5000 - 500 = 13500
    expect(series[2].balance).toBe(13500);
  });

  it("includes only transactions dated on or before month end", () => {
    const now = new Date(2026, 0, 31); // January 2026
    const series = computeBalanceSeries(
      [
        { date: "2026-01-31", amount_cents: -200 },
        { date: "2026-02-01", amount_cents: -9999 },
      ],
      1000,
      now,
    );

    expect(series).toHaveLength(1);
    expect(series[0].balance).toBe(800);
  });
});
