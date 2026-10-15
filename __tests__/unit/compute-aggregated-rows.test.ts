import { describe, expect, it } from "vitest";

import { filterTransactionsAfterAnchor } from "@/lib/accounts/balance-after-anchor";
import { computeBalanceSeries } from "@/lib/accounts/compute-balance-series";
import {
  accountBalanceTotals,
  goalMonthlyToTransactions,
  monthlyDeltasToTransactions,
  type AccountMonthlyDeltaRow,
  type GoalCategoryMonthlyRow,
} from "@/lib/accounts/compute-aggregated-rows";
import { computeGoalProgressSeries } from "@/lib/savings-goals/compute-goal-progress-series";

// Synthetic data only. The SQL functions are re-implemented here in plain JS
// (same group-by) to prove the page's figures do not change when it reads
// aggregates instead of every row.
const accounts = [
  { id: "a1", anchor: "1900-01-01", initial: 100_000 },
  { id: "a2", anchor: "2026-02-10", initial: 5_000 },
];
const anchorByAccountId = new Map(accounts.map((a) => [a.id, a.anchor]));
const txs = [
  { account_id: "a1", date: "2025-11-30", amount_cents: -1_200, category_id: "c1" },
  { account_id: "a1", date: "2025-12-31", amount_cents: 250_000, category_id: null },
  { account_id: "a1", date: "2026-01-01", amount_cents: -4_550, category_id: "c1" },
  { account_id: "a1", date: "2026-01-20", amount_cents: -900, category_id: "c2" },
  { account_id: "a1", date: "2026-03-05", amount_cents: -7_777, category_id: "c1" },
  { account_id: "a2", date: "2026-02-10", amount_cents: -3_000, category_id: "c1" }, // on the anchor: not counted
  { account_id: "a2", date: "2026-02-11", amount_cents: 12_345, category_id: "c2" },
  { account_id: "a2", date: "2026-04-02", amount_cents: -99, category_id: "c1" },
];
const now = new Date(2026, 3, 20);

function sqlMonthlyDeltas(): AccountMonthlyDeltaRow[] {
  const sums = new Map<string, number>();
  for (const tx of filterTransactionsAfterAnchor(txs, anchorByAccountId)) {
    const key = `${tx.account_id}|${tx.date.slice(0, 7)}`;
    sums.set(key, (sums.get(key) ?? 0) + tx.amount_cents);
  }
  return [...sums].map(([key, total]) => ({ account_id: key.split("|")[0]!, month: key.split("|")[1]!, total_cents: String(total) }));
}

describe("monthlyDeltasToTransactions", () => {
  it("gives the same net worth series as summing every transaction", () => {
    const initial = accounts.reduce((s, a) => s + a.initial, 0);
    const before = computeBalanceSeries(filterTransactionsAfterAnchor(txs, anchorByAccountId), initial, now, "2026-04");
    const after = computeBalanceSeries(monthlyDeltasToTransactions(sqlMonthlyDeltas()), initial, now, "2026-04");
    expect(after).toEqual(before);
    expect(after.length).toBeGreaterThan(4);
  });

  it("keeps the start month of the earliest counted transaction", () => {
    const series = computeBalanceSeries(monthlyDeltasToTransactions(sqlMonthlyDeltas()), 0, now, "2026-04");
    expect(series[0]!.month).toMatch(/nov/i);
  });

  it("returns a single flat point with no rows", () => {
    expect(computeBalanceSeries(monthlyDeltasToTransactions([]), 42, now, "2026-04")).toEqual(
      computeBalanceSeries([], 42, now, "2026-04"),
    );
  });
});

describe("goalMonthlyToTransactions", () => {
  const goals = [
    { id: "g1", name: "Voyage", linked_category_id: "c1", color: null },
    { id: "g2", name: "Manuel", linked_category_id: null, color: null },
  ];

  it("gives the same goal progress as summing every linked transaction", () => {
    const linked = txs.filter((t) => t.category_id === "c1");
    const sums = new Map<string, number>();
    for (const t of linked) {
      const key = `${t.category_id}|${t.date.slice(0, 7)}`;
      sums.set(key, (sums.get(key) ?? 0) + Math.abs(t.amount_cents));
    }
    const rows: GoalCategoryMonthlyRow[] = [...sums].map(([k, v]) => ({
      category_id: k.split("|")[0]!,
      month: k.split("|")[1]!,
      total_abs_cents: v,
    }));
    for (const monthCount of [3, 6, null]) {
      const before = computeGoalProgressSeries(linked, goals, monthCount, now, "2026-04");
      const after = computeGoalProgressSeries(goalMonthlyToTransactions(rows), goals, monthCount, now, "2026-04");
      expect(after).toEqual(before);
    }
  });
});

describe("accountBalanceTotals", () => {
  it("indexes sums by account and coerces bigint strings", () => {
    const { todayByAccountId, windowByAccountId } = accountBalanceTotals([
      { account_id: "a1", today_cents: "1000", window_cents: 400 },
    ]);
    expect(todayByAccountId.get("a1")).toBe(1000);
    expect(windowByAccountId.get("a1")).toBe(400);
    expect(todayByAccountId.get("zz") ?? 0).toBe(0);
  });
});
