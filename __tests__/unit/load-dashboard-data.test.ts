import { describe, expect, it, vi } from "vitest";

import { loadDashboardData } from "@/lib/dashboard/load-dashboard-data";
import { groupByCategoryId, sumAbsByCategoryId } from "@/lib/dashboard/group-by-category";

import { dashboardRpc } from "./helpers/dashboard-rpc-fake";

type Row = Record<string, unknown>;

/** Table builder that, like PostgREST, never returns more than 1000 rows to a raw select. */
function fakeSupabase(tables: Record<string, Row[]>, overrides: Record<string, () => unknown> = {}) {
  const from = (table: string) => {
    let rows = [...(tables[table] ?? [])];
    const q: Record<string, unknown> = {};
    const chain = () => q;
    for (const m of ["select", "eq", "is", "not", "in", "gte", "lte", "lt", "order"]) q[m] = chain;
    q.range = (a: number, b: number) => { rows = rows.slice(a, b + 1); return q; };
    q.limit = (n: number) => { rows = rows.slice(0, n); return q; };
    q.maybeSingle = () => Promise.resolve({ data: rows[0] ?? null, error: null });
    q.then = (resolve: (r: unknown) => unknown) => Promise.resolve({ data: rows.slice(0, 1000), error: null }).then(resolve);
    return q;
  };
  const rpc = vi.fn((name: string, args: Row) =>
    Promise.resolve(overrides[name] ? overrides[name]() : { data: dashboardRpc(name, args, tables), error: null }),
  );
  return { from, rpc } as never;
}

const base = (extra: Partial<Parameters<typeof loadDashboardData>[0]> = {}) => ({
  spaceId: "s",
  spaceKind: "personal",
  searchParams: { period: "1a" },
  now: new Date("2026-10-15T12:00:00Z"),
  ...extra,
});

const account = { id: "a1", space_id: "s", name: "Courant", type: "courant", bank: null, initial_balance_cents: 0, balance_anchor_date: "2000-01-01", deleted_at: null };
const food = { name: "Courses", color: "#111111", icon: "basket", is_default: false, translation_key: null };

describe("loadDashboardData", () => {
  it("returns exact totals beyond PostgREST's 1000-row cap (issue 162)", async () => {
    // 1500 expenses of 10 € in October + 5 incomes of 1000 €: a raw select would stop at 1000 lines.
    const transactions: Row[] = [
      ...Array.from({ length: 1500 }, (_, i) => ({ id: `e${i}`, space_id: "s", account_id: "a1", kind: "expense", amount_cents: -1000, date: "2026-10-05", category_id: "food", categories: food, deleted_at: null, description: null })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `i${i}`, space_id: "s", account_id: "a1", kind: "income", amount_cents: 100000, date: "2026-09-05", category_id: null, categories: null, deleted_at: null, description: null })),
    ];
    const data = await loadDashboardData({ ...base({ searchParams: { period: "3m" } }), supabase: fakeSupabase({ accounts: [account], transactions }) });
    expect(data.periodExpense).toBe(1_500_000);
    expect(data.periodIncome).toBe(500_000);
    expect(data.donutData).toEqual([expect.objectContaining({ name: "Courses", value: 1_500_000 })]);
    expect(data.consolidatedBalance).toBe(500_000 - 1_500_000);
    const october = data.barData.find((p) => p.key === "2026-10");
    expect(october?.expense).toBe(1_500_000);
    // The raw overlay lines stay explicitly capped, totals do not.
    expect(data.donutTransactionsByCategory.food!.length).toBeLessThanOrEqual(500);
  });

  it("throws when an aggregate RPC fails instead of returning zeros", async () => {
    const failing = { dashboard_category_totals: () => ({ data: null, error: { message: "rpc failed" } }) };
    await expect(loadDashboardData({ ...base(), supabase: fakeSupabase({ accounts: [account] }, failing) })).rejects.toThrow("rpc failed");
  });

  it("throws when the account-wide aggregate fails", async () => {
    const failing = { dashboard_account_totals: () => ({ data: null, error: { message: "totals failed" } }) };
    await expect(loadDashboardData({ ...base(), supabase: fakeSupabase({ accounts: [account] }, failing) })).rejects.toThrow("totals failed");
  });

  it("does not wait for the account list before firing the aggregates (single round-trip for snapshot data)", async () => {
    const supabase = fakeSupabase({ accounts: [account] });
    await loadDashboardData({ ...base(), supabase });
    const names = (supabase as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc.mock.calls.map((c) => c[0]);
    expect(names).toEqual(expect.arrayContaining(["dashboard_account_totals", "dashboard_goal_category_totals", "dashboard_net_cents"]));
  });
});

describe("group-by-category helpers", () => {
  it("groups by category and drops uncategorized rows", () => {
    const rows = [
      { id: "1", date: "d", description: null, category_id: "c", amount_cents: -5 },
      { id: "2", date: "d", description: "x", category_id: null, amount_cents: -7 },
    ];
    expect(groupByCategoryId(rows)).toEqual({ c: [{ id: "1", date: "d", description: null, amount_cents: -5 }] });
  });

  it("sums absolute amounts per category", () => {
    expect(sumAbsByCategoryId([{ category_id: "c", amount_cents: -5 }, { category_id: "c", amount_cents: 3 }, { category_id: null, amount_cents: 9 }])).toEqual({ c: 8 });
  });
});
