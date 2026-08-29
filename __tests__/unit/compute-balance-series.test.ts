import { describe, expect, it } from "vitest";

import {
  computeBalanceSeries,
  computeDailyBalanceSeries,
} from "@/lib/accounts/compute-balance-series";

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
    expect(series[0].balance).toBe(9000);
    expect(series[1].balance).toBe(14000);
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

  it("covers more than 2 years so chart range filters can differ", () => {
    const now = new Date(2026, 6, 15); // July 2026
    const txs = [];
    for (let y = 2024; y <= 2026; y++) {
      const lastMonth = y === 2026 ? 6 : 12;
      for (let m = 1; m <= lastMonth; m++) {
        const mm = String(m).padStart(2, "0");
        txs.push({ date: `${y}-${mm}-05`, amount_cents: 100 });
      }
    }

    const series = computeBalanceSeries(txs, 0, now);
    expect(series.length).toBeGreaterThan(24);
    expect(series).toHaveLength(31);
    expect(series.slice(-3)).toHaveLength(3);
    expect(series.slice(-6)).toHaveLength(6);
    expect(series.slice(-12)).toHaveLength(12);
    expect(series.slice(-24)).toHaveLength(24);
    expect(series.slice(-3)[0].month).not.toBe(series.slice(-6)[0].month);
    expect(series.slice(-6)[0].month).not.toBe(series.slice(-12)[0].month);
    expect(series.slice(-12)[0].month).not.toBe(series.slice(-24)[0].month);
    expect(series.slice(-24)[0].month).not.toBe(series[0].month);
    expect(series[series.length - 1].balance).toBe(3000);
  });
});

describe("computeDailyBalanceSeries", () => {
  it("emits one point per day with running balance", () => {
    const series = computeDailyBalanceSeries(
      [
        { date: "2026-07-02", amount_cents: -1000 },
        { date: "2026-07-04", amount_cents: 5000 },
      ],
      10_000,
      "2026-07-01",
      "2026-07-04",
    );

    expect(series).toHaveLength(4);
    expect(series.map((p) => p.date)).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-04",
    ]);
    expect(series.map((p) => p.balance)).toEqual([10_000, 9_000, 9_000, 14_000]);
  });

  it("includes transactions before the window in the starting balance", () => {
    const series = computeDailyBalanceSeries(
      [
        { date: "2026-06-15", amount_cents: -2000 },
        { date: "2026-07-01", amount_cents: 500 },
      ],
      10_000,
      "2026-07-01",
      "2026-07-01",
    );

    expect(series).toHaveLength(1);
    expect(series[0].balance).toBe(8_500);
  });

  it("normalizes timestamp dates so daily lookups match", () => {
    const series = computeDailyBalanceSeries(
      [
        { date: "2026-05-01T00:00:00+00:00", amount_cents: -85_000 },
        { date: "2026-05-05T00:00:00+00:00", amount_cents: 285_000 },
      ],
      150_000,
      "2026-05-01",
      "2026-05-05",
    );

    const balances = series.map((p) => p.balance);
    expect(new Set(balances).size).toBeGreaterThan(1);
    expect(balances[0]).toBe(65_000); // 150000 - 85000
    expect(balances[balances.length - 1]).toBe(350_000); // + salaire
  });
});
