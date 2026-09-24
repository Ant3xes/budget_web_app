import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import { computeExpenseByCategory } from "@/lib/accounts/compute-expense-by-category";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { fetchSharedExpenseActivity, toActivityRow } from "@/lib/shared-expenses/activity-rows";

const CATEGORIES = { name: "Logement", color: "#3b82f6", icon: "🏠", is_default: true, translation_key: "logement" };

const sharedRow = (overrides: Partial<Parameters<typeof toActivityRow>[0]> = {}) => ({
  source_transaction_id: "tx-1",
  date: "2026-09-01T00:00:00+00:00",
  description: "Loyer",
  amount_cents: 85000,
  category_id: "cat-logement",
  categories: CATEGORIES,
  ...overrides,
});

/** A chainable Supabase double that resolves each page of `pages` in turn. */
function buildSupabase(pages: unknown[][]) {
  const calls: Record<string, unknown[][]> = {};
  const record = (name: string) => (...args: unknown[]) => {
    (calls[name] ??= []).push(args);
    return chain;
  };
  let page = 0;
  const chain: Record<string, unknown> = {
    select: record("select"),
    eq: record("eq"),
    gte: record("gte"),
    lte: record("lte"),
    lt: record("lt"),
    in: record("in"),
    order: record("order"),
    range: (...args: unknown[]) => {
      (calls.range ??= []).push(args);
      return Promise.resolve({ data: pages[page++] ?? [], error: null });
    },
  };
  const from = vi.fn(() => chain);
  return { supabase: { from } as unknown as SupabaseClient, from, calls };
}

describe("toActivityRow", () => {
  it("turns a shared expense into an expense activity row keyed by its source transaction", () => {
    expect(toActivityRow(sharedRow())).toEqual({
      id: "tx-1",
      date: "2026-09-01T00:00:00+00:00",
      description: "Loyer",
      kind: "expense",
      amount_cents: 85000,
      category_id: "cat-logement",
      categories: CATEGORIES,
    });
  });

  it("feeds the existing aggregations unchanged (positive amounts, Math.abs inside)", () => {
    const rows = [toActivityRow(sharedRow()), toActivityRow(sharedRow({ source_transaction_id: "tx-2", amount_cents: 15000 }))];

    const donut = computeExpenseByCategory(
      rows.map((row) => ({
        amount_cents: row.amount_cents,
        categoryName: (row.categories as typeof CATEGORIES).name,
        categoryColor: (row.categories as typeof CATEGORIES).color,
        categoryId: row.category_id,
      })),
    );
    expect(donut).toHaveLength(1);
    expect(donut[0]).toMatchObject({ name: "Logement", value: 100000 });

    const series = computeIncomeExpenseSeries(rows, 1, new Date("2026-09-15T00:00:00Z"), "2026-09");
    expect(series.at(-1)).toMatchObject({ expense: 100000, income: 0 });
  });
});

describe("fetchSharedExpenseActivity", () => {
  it("scopes to the space and the window (inclusive upper bound by default)", async () => {
    const { supabase, from, calls } = buildSupabase([[sharedRow()]]);

    const rows = await fetchSharedExpenseActivity(supabase, "space-1", { from: "2026-09-01", to: "2026-09-30" });

    expect(from).toHaveBeenCalledWith("shared_expenses");
    expect(calls.eq).toContainEqual(["space_id", "space-1"]);
    expect(calls.gte).toContainEqual(["date", "2026-09-01"]);
    expect(calls.lte).toContainEqual(["date", "2026-09-30"]);
    expect(calls.lt).toBeUndefined();
    expect(rows.map((row) => row.id)).toEqual(["tx-1"]);
  });

  it("uses a half-open window when asked (the 'this month' budget query)", async () => {
    const { supabase, calls } = buildSupabase([[]]);

    await fetchSharedExpenseActivity(supabase, "space-1", { from: "2026-09-01", to: "2026-10-01", toInclusive: false });

    expect(calls.lt).toContainEqual(["date", "2026-10-01"]);
    expect(calls.lte).toBeUndefined();
  });

  it("restricts to the given categories, and returns nothing without querying for an empty list", async () => {
    const restricted = buildSupabase([[]]);
    await fetchSharedExpenseActivity(restricted.supabase, "space-1", {
      from: "2026-09-01",
      to: "2026-09-30",
      categoryIds: ["cat-a", "cat-b"],
    });
    expect(restricted.calls.in).toContainEqual(["category_id", ["cat-a", "cat-b"]]);

    const empty = buildSupabase([[sharedRow()]]);
    expect(
      await fetchSharedExpenseActivity(empty.supabase, "space-1", { from: "a", to: "b", categoryIds: [] }),
    ).toEqual([]);
    expect(empty.from).not.toHaveBeenCalled();
  });

  it("reads every page, not just the first 1000 rows", async () => {
    const full = Array.from({ length: 1000 }, (_, index) => sharedRow({ source_transaction_id: `tx-${index}` }));
    const { supabase, calls } = buildSupabase([full, [sharedRow({ source_transaction_id: "tx-last" })]]);

    const rows = await fetchSharedExpenseActivity(supabase, "space-1", { from: "2026-01-01", to: "2026-12-31" });

    expect(rows).toHaveLength(1001);
    expect(calls.range).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });
});
