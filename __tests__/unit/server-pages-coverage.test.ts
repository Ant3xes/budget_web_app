import { Children, Suspense, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AnalyticsPage from "@/app/(app)/analytics/page";
import DashboardPage from "@/app/(app)/dashboard/page";
import AccountsPage from "@/app/(app)/accounts/page";
import AccountDetailPage from "@/app/(app)/accounts/[id]/page";
import { CashflowChart } from "@/components/analytics/deferred-charts";
import { NetWorthChart } from "@/components/analytics/net-worth-chart";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";
import { CategoryHistogramChart } from "@/components/analytics/category-histogram-chart";
import { CategoryBreakdownToggle } from "@/components/analytics/category-breakdown-toggle";
import { BudgetVsActualChart } from "@/components/analytics/budget-vs-actual-chart";
import { TopCategoriesMerchants } from "@/components/analytics/top-categories-merchants";
import { FixedChargesShareStat } from "@/components/analytics/fixed-charges-share-stat";
import { DivergingBarChart } from "@/components/analytics/deferred-charts";
import { ExpenseCalendarHeatmap } from "@/components/analytics/expense-calendar-heatmap";
import { GoalProgressChart } from "@/components/analytics/goal-progress-chart";
import { YearOverYearChart } from "@/components/analytics/deferred-charts";
import { PeriodSelector } from "@/components/period-selector";
import { ExpenseIncomeLine } from "@/components/dashboard/expense-income-line";
import { ConsolidatedBalanceTile } from "@/components/dashboard/consolidated-balance-tile";
import { RemainingToLive } from "@/components/dashboard/remaining-to-live";
import { ExpenseByCategoryWidget } from "@/components/dashboard/expense-by-category-widget";
import { BudgetStackedChart } from "@/components/dashboard/budget-stacked-chart";
import { FixedChargesSummary } from "@/components/dashboard/fixed-charges-summary";
import { SavingsGoalsSummary } from "@/components/dashboard/savings-goals-summary";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { AccountsList } from "@/components/accounts/accounts-list";
import { AccountSelector } from "@/components/dashboard/account-selector";
import { T } from "@/components/i18n/t";
import { dashboardRpc } from "./helpers/dashboard-rpc-fake";

const { requireSpaceContext, notFound } = vi.hoisted(() => ({
  requireSpaceContext: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }),
}));
vi.mock("@/lib/spaces/context", () => ({ requireSpaceContext }));
vi.mock("next/navigation", () => ({ notFound }));

type Row = Record<string, unknown>;
type Element = ReactElement<Record<string, unknown>>;

// issue 121: exercise the server composition, leaving client charts unexecuted.
function elements(node: ReactNode): Element[] {
  return Children.toArray(node).flatMap((child) => !isValidElement<{ children?: ReactNode }>(child)
    ? [] : [child as Element, ...elements(child.props.children)]);
}
function props(tree: Element[], type: unknown): Record<string, unknown> {
  const found = tree.find((element) => element.type === type);
  expect(found, "expected rendered component").toBeDefined();
  return found!.props;
}

// A small PostgREST boundary fake: predicates operate on synthetic source rows,
// so removing a page's date/account/deletion predicate changes the assertions.
function database(tables: Record<string, Row[] | null>, rpcRows: Record<string, Row[] | null> = {}, ignoreCategoryIn = false, nullSelects: string[] = []) {
  const from = vi.fn((table: string) => {
    let rows = [...(tables[table] ?? [])];
    let columns = "";
    const filter = (predicate: (row: Row) => boolean) => { rows = rows.filter(predicate); return query; };
    const query = {
      select: (selected: string) => { columns = selected; return query; },
      eq: (key: string, value: unknown) => filter((row) => row[key] === value),
      is: (key: string, value: unknown) => filter((row) => (row[key] ?? null) === value),
      not: (key: string, _operator: string, value: unknown) => filter((row) => (row[key] ?? null) !== value),
      in: (key: string, values: unknown[]) => filter((ignoreCategoryIn && key === "category_id") ? () => true : (row) => values.includes(row[key])),
      gte: (key: string, value: string) => filter((row) => row[key] != null && String(row[key]) >= value),
      lte: (key: string, value: string) => filter((row) => row[key] != null && String(row[key]) <= value),
      lt: (key: string, value: string) => filter((row) => row[key] != null && String(row[key]) < value),
      order: () => query,
      limit: (count: number) => { rows = rows.slice(0, count); return query; },
      range: (start: number, end: number) => { rows = rows.slice(start, end + 1); return query; },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      single: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (result: { data: Row[] | null; error: null }) => unknown) =>
        Promise.resolve({ data: tables[table] === null || nullSelects.includes(columns) ? null : rows, error: null }).then(resolve),
    };
    return query;
  });
  return {
    from,
    rpc: vi.fn((name: string, args: Record<string, unknown> = {}) =>
      Promise.resolve({ data: name.startsWith("dashboard_") ? dashboardRpc(name, args, tables) : (rpcRows[name] ?? null), error: null })),
  };
}
const category = { name: "Courses test", color: "#123456", icon: "basket", is_default: true, translation_key: "categories.food" };
function account(id = "current", overrides: Row = {}): Row {
  return { id, space_id: "space-test", name: id, type: "courant", bank: "Banque fictive", currency: "EUR", initial_balance_cents: 100000, balance_anchor_date: "2026-01-01", deleted_at: null, ...overrides };
}
function tx(id: string, amount_cents: number, overrides: Row = {}): Row {
  return { id, account_id: "current", space_id: "space-test", date: "2026-10-10", amount_cents, kind: amount_cents < 0 ? "expense" : "income", currency: "EUR", description: "Marchand test", category_id: "food", categories: category, deleted_at: null, reimburses_transaction_id: null, ...overrides };
}
function context(tables: Record<string, Row[] | null> = {}, kind = "personal", rpcRows: Record<string, Row[] | null> = {}, ignoreCategoryIn = false, nullSelects: string[] = []) {
  const db = database(tables, rpcRows, ignoreCategoryIn, nullSelects);
  requireSpaceContext.mockResolvedValue({ supabase: db, spaceId: "space-test", space: { kind } });
  return db;
}
async function analytics(search: { tab?: string; period?: string } = {}) {
  const page = await AnalyticsPage({ searchParams: Promise.resolve(search) });
  const header = elements(page);
  const boundary = header.find((element) => element.type === Suspense)!;
  const child = boundary.props.children as Element;
  const body = await (child.type as (p: Record<string, unknown>) => Promise<ReactNode>)(child.props);
  const sections = elements(body);
  // Execute only this module's synchronous Section wrapper, not client charts.
  const wrappers = sections.filter((element) => typeof element.type === "function" && element.type.name === "Section");
  for (const element of wrappers) (element.type as (p: Record<string, unknown>) => ReactNode)(element.props);
  return { header, boundary, tree: [...header, ...sections] };
}
async function dashboard(search: { period?: string; accounts?: string } = {}) {
  return elements(await DashboardPage({ searchParams: Promise.resolve(search) }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe("analytics server page coverage", () => {
  it("streams a default 1m overview, with accessible loading and net activity but gross balances", async () => {
    const db = context({ accounts: [account()], transactions: [tx("expense", -9000), tx("refund", 3000, { reimburses_transaction_id: "expense" }), tx("salary", 20000), tx("future", -5000, { date: "2026-10-20" }), tx("old", -8000, { date: "2026-09-01" })] }, "personal", {
      analytics_account_monthly_deltas: [{ account_id: "current", month: "2026-10", total_cents: 14000 }],
    });
    const { tree, boundary } = await analytics({ tab: "unknown" });
    expect(props(tree, AnalyticsTabs).current).toBe("overview");
    expect(props(tree, PeriodSelector)).toMatchObject({ current: { type: "month", month: "2026-10" }, tabParam: undefined });
    expect(props(tree, CashflowChart).data).toMatchObject([{ key: "2026-10", income: 20000, expense: 6000 }]);
    expect(props(tree, NetWorthChart).data).toMatchObject([{ balance: 114000 }]);
    const fallback = boundary.props.fallback as Element;
    const skeleton = elements((fallback.type as () => ReactNode)());
    expect(skeleton.some((node) => node.props.role === "status" && node.props["aria-live"] === "polite")).toBe(true);
    expect(db.rpc).toHaveBeenCalledWith("analytics_account_monthly_deltas", { p_space_id: "space-test", p_account_ids: ["current"] });
  });

  it.each(["6m", "1a", "tout", "2026-08:2026-09"])("resolves the %s overview window", async (period) => {
    context({ accounts: [account()], transactions: [tx("old", -1200, { date: "2026-08-10" }), tx("new", -2300)] });
    const { tree } = await analytics({ period });
    const data = props(tree, CashflowChart).data as Row[];
    expect(data.reduce((total, row) => total + Number(row.expense), 0)).toBe(period.includes(":") ? 1200 : 3500);
    expect(data.at(-1)?.key).toBe(period.includes(":") ? "2026-09" : "2026-10");
  });

  it("builds categories, recurring merchants, net budgets and translated/fallback slices", async () => {
    context({ accounts: [account()], transactions: [
      tx("food-a", -9000), tx("refund", 3000, { reimburses_transaction_id: "food-a" }), tx("food-b", -1000),
      tx("none", -500, { category_id: null, categories: null, description: null }),
      tx("missing-meta", -400, { category_id: "other", categories: null, description: "Autre" }),
      tx("other-a", -200, { category_id: "other", categories: null, description: "Autre" }),
      tx("year", -2500, { date: "2026-02-01" }),
    ], budgets: [
      { id: "budget", space_id: "space-test", month: "2026-10-01", category_id: "food", amount_cents: 10000, categories: category },
      { id: "empty", space_id: "space-test", month: "2026-10-01", category_id: "missing", amount_cents: 2000, categories: null },
    ] });
    const { tree } = await analytics({ tab: "categories" });
    expect(props(tree, PeriodSelector).tabParam).toBe("categories");
    expect(props(tree, BudgetVsActualChart).rows).toEqual([
      expect.objectContaining({ consumed: 7000, amount: 10000, isDefault: true }),
      expect.objectContaining({ consumed: 0, categoryName: null, isDefault: false }),
    ]);
    expect(props(tree, TopCategoriesMerchants).topMerchants).toEqual([
      { description: "Marchand test", count: 2, total: 7000 }, { description: "Autre", count: 2, total: 600 },
    ]);
    // Rows without joined category metadata merge into one "Sans catégorie" slice.
    expect(props(tree, CategoryHistogramChart).data).toEqual([
      expect.objectContaining({ value: 7000, is_default: true, translation_key: "categories.food" }),
      expect.objectContaining({ value: 1100, is_default: false, translation_key: null }),
    ]);
    const donut = props(tree, CategoryBreakdownToggle);
    expect((donut.yearData as Row[]).reduce((sum, row) => sum + Number(row.value), 0)).toBe(10600);
  });

  it("keeps account snapshots independent of reimbursements and uses today for fixed charges", async () => {
    const db = context({ accounts: [account(), account("current-2"), account("saving", { type: "livret", initial_balance_cents: 20000, bank: null })], fixed_charges: [
      { space_id: "space-test", status: "active", next_due_date: "2026-10-20", amount_cents: 2000 },
      { space_id: "space-test", status: "active", next_due_date: "2026-11-01", amount_cents: 9000 },
    ] }, "personal", { analytics_account_balances: [{ account_id: "current", today_cents: -10000, window_cents: -20000 }] });
    const { tree } = await analytics({ tab: "accounts", period: "tout" });
    expect(props(tree, FixedChargesShareStat)).toMatchObject({ courantBalanceCents: 190000, upcomingFixedChargesCents: 2000 });
    expect(props(tree, DivergingBarChart).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "courant", value: 180000 }), expect.objectContaining({ id: "livret", value: 20000 }),
    ]));
    expect(db.from.mock.calls.map(([table]) => table)).not.toContain("transactions");
    expect(db.rpc).toHaveBeenCalledWith("analytics_account_balances", expect.objectContaining({ p_window_to: "2026-10-15" }));
  });

  it("renders a past custom month's heatmap with daily net totals", async () => {
    context({ accounts: [account()], transactions: [tx("one", -9000, { date: "2026-02-10" }), tx("two", -1000, { date: "2026-02-10" }), tx("refund", 3000, { reimburses_transaction_id: "one" }), tx("outside", -7000)] });
    const { tree } = await analytics({ tab: "transactions", period: "2026-02:2026-02" });
    const days = props(tree, ExpenseCalendarHeatmap).days as Row[];
    expect(days).toHaveLength(28);
    expect(days.find((day) => day.date === "2026-02-10")).toEqual({ date: "2026-02-10", amountCents: 7000 });
    expect(days[0]).toEqual({ date: "2026-02-01", amountCents: 0 });
  });

  it.each(["1a", "tout"])("compares annual income and expenses and separates manual/linked goals for %s", async (period) => {
    context({ accounts: [account()], transactions: [tx("current", -2000), tx("prior", -1000, { date: "2025-10-10" }), tx("salary", 6000)], savings_goals: [
      { id: "manual", space_id: "space-test", name: "Manuel", current_amount_cents: 500, target_amount_cents: 1000, linked_category_id: null, color: null },
      { id: "linked", space_id: "space-test", name: "Lié", current_amount_cents: 0, target_amount_cents: 10000, linked_category_id: "food", color: "red" },
    ] }, "personal", { analytics_goal_category_monthly: [
      { category_id: "food", month: "2026-09", total_abs_cents: 1000 }, { category_id: "food", month: "2026-10", total_abs_cents: 2000 },
    ] });
    const { tree } = await analytics({ tab: "comparisons", period });
    expect(tree.filter((element) => element.type === YearOverYearChart)).toHaveLength(2);
    expect(props(tree, GoalProgressChart).manualGoals).toEqual([{ id: "manual", name: "Manuel", currentCents: 500, targetCents: 1000 }]);
    expect(props(tree, GoalProgressChart).series).toEqual(expect.arrayContaining([expect.objectContaining({ key: "linked" })]));
  });

  it.each(["overview", "categories", "transactions", "comparisons"])("includes shared expenses only as activity in %s", async (tab) => {
    context({ accounts: [], shared_expenses: [{ space_id: "space-test", source_transaction_id: "shared", date: "2026-10-10", amount_cents: 1500, category_id: "food", categories: category, description: "Partagé" }] }, "shared");
    const { tree } = await analytics({ tab, period: "tout" });
    expect(tree.some((node) => node.type === T && node.props.k === "analytics.sharedNote")).toBe(true);
    if (tab === "overview") expect((props(tree, CashflowChart).data as Row[]).at(-1)?.expense).toBe(1500);
    if (tab === "categories") expect(props(tree, CategoryHistogramChart).data).toEqual([expect.objectContaining({ value: 1500 })]);
    if (tab === "transactions") expect((props(tree, ExpenseCalendarHeatmap).days as Row[]).find((day) => day.date === "2026-10-10")?.amountCents).toBe(1500);
    if (tab === "comparisons") expect(props(tree, GoalProgressChart).manualGoals).toEqual([]);
  });

  it.each(["overview", "categories", "accounts", "transactions", "comparisons"])("renders %s without data, including null backend results", async (tab) => {
    context({ accounts: null, transactions: null, budgets: null, fixed_charges: null, savings_goals: null });
    const { tree } = await analytics({ tab });
    expect(props(tree, AnalyticsTabs).current).toBe(tab);
    if (tab === "categories") expect(props(tree, BudgetVsActualChart).rows).toEqual([]);
    if (tab === "accounts") expect(props(tree, DivergingBarChart).data).toEqual([]);
    if (tab === "comparisons") expect(props(tree, GoalProgressChart).manualGoals).toEqual([]);
  });
});

describe("analytics and dashboard with accounts but failing data queries", () => {
  const nulls = { accounts: [account(), account("saving", { type: "livret" })], transactions: null, budgets: null, savings_goals: null, fixed_charges: null };

  it.each(["overview", "categories", "accounts", "transactions", "comparisons"])("shows empty analytics for %s", async (tab) => {
    context(nulls);
    const { tree } = await analytics({ tab });
    expect(props(tree, AnalyticsTabs).current).toBe(tab);
    if (tab === "overview") expect(props(tree, CashflowChart).data).toEqual([{ key: "2026-10", month: expect.any(String), income: 0, expense: 0 }]);
    if (tab === "accounts") expect(props(tree, FixedChargesShareStat)).toMatchObject({ courantBalanceCents: 100000, upcomingFixedChargesCents: 0 });
  });

  it("ignores goal rows without a category", async () => {
    context({ accounts: [account()], savings_goals: [{ id: "manual", space_id: "space-test", name: "Manuel", current_amount_cents: 500, target_amount_cents: 1000, linked_category_id: null }] }, "personal", {
      analytics_goal_category_monthly: [{ category_id: null, month: "2026-10", total_abs_cents: 900 }],
    });
    const { tree } = await analytics({ tab: "comparisons" });
    expect(props(tree, GoalProgressChart).manualGoals).toEqual([expect.objectContaining({ currentCents: 500 })]);
  });

  it("keeps budget and goal totals from the SQL aggregates when the raw overlay rows come back empty", async () => {
    context({ accounts: [account()], transactions: [tx("spent", -900)], budgets: [
      { id: "budget", space_id: "space-test", month: "2026-10-01", category_id: "food", amount_cents: 5000, categories: category },
    ], savings_goals: [{ id: "linked", space_id: "space-test", name: "Lié", target_amount_cents: 1000, current_amount_cents: 0, linked_category_id: "food" }] },
    "personal", {}, false, ["id, date, description, category_id, amount_cents"]);
    const tree = await dashboard();
    // issue 162: totals no longer depend on the (capped) raw lines.
    expect(props(tree, BudgetStackedChart).rows).toEqual([expect.objectContaining({ consumed: 900 })]);
    expect(props(tree, BudgetStackedChart).transactionsByCategory).toEqual({});
    expect(props(tree, SavingsGoalsSummary).goals).toEqual([expect.objectContaining({ currentCents: 900 })]);
  });

  it("throws on a Supabase error instead of rendering zeros (error.tsx takes over)", async () => {
    const db = context({ accounts: [account()], transactions: [tx("spent", -900)] });
    db.rpc.mockImplementation((() => Promise.resolve({ data: null, error: { message: "permission denied", code: "42501" } })) as never);
    await expect(dashboard()).rejects.toThrow("permission denied");
  });

  it("shows an empty dashboard with accounts but no data", async () => {
    context(nulls);
    const tree = await dashboard();
    expect(props(tree, ConsolidatedBalanceTile).amountCents).toBe(200000);
    expect(props(tree, ExpenseIncomeLine)).toMatchObject({ periodExpense: 0, periodIncome: 0 });
    expect(props(tree, SavingsGoalsSummary).goals).toEqual([]);
    expect(props(tree, FixedChargesSummary)).toMatchObject({ charges: [], totalCents: 0 });
  });

  it("does not attribute uncategorized rows to any budget or goal", async () => {
    context({ accounts: [account()], transactions: [tx("loose", -900, { category_id: null, categories: null })], budgets: [
      { id: "budget", space_id: "space-test", month: "2026-10-01", category_id: "food", amount_cents: 5000, categories: category },
    ], savings_goals: [{ id: "linked", space_id: "space-test", name: "Lié", target_amount_cents: 1000, current_amount_cents: 0, linked_category_id: "food" }] }, "personal", {}, true);
    const tree = await dashboard();
    expect(props(tree, BudgetStackedChart).rows).toEqual([expect.objectContaining({ consumed: 0 })]);
    expect(props(tree, SavingsGoalsSummary).goals).toEqual([expect.objectContaining({ currentCents: 0 })]);
  });
});

describe("dashboard server page coverage", () => {
  function richContext(kind = "personal") {
    return context({ accounts: [account(), account("other"), account("saving", { type: "livret", initial_balance_cents: 20000 }), account("deleted", { deleted_at: "2026-10-01" })], transactions: [
      tx("expense", -9000), tx("refund", 3000, { reimburses_transaction_id: "expense" }), tx("salary", 20000), tx("food-two", -1000),
      tx("none", -500, { category_id: null, categories: null }), tx("missing-meta", -400, { category_id: "missing", categories: null }),
      tx("deleted", -80000, { deleted_at: "2026-10-10" }), tx("deleted-account", -80000, { account_id: "deleted" }),
      tx("old", -70000, { date: "2025-12-01" }), tx("saving", 5000, { account_id: "saving", category_id: "goal" }),
    ], budgets: [
      { id: "small", space_id: "space-test", month: "2026-10-01", category_id: "missing", amount_cents: 1000, categories: null },
      { id: "large", space_id: "space-test", month: "2026-10-01", category_id: "food", amount_cents: 10000, categories: category },
    ], savings_goals: [
      { id: "manual", space_id: "space-test", name: "Manuel", target_amount_cents: 10000, current_amount_cents: 1000, linked_category_id: null },
      { id: "linked", space_id: "space-test", name: "Lié", target_amount_cents: 10000, current_amount_cents: 0, linked_category_id: "goal" },
    ], fixed_charges: [
      { id: "due", space_id: "space-test", status: "active", name: "À venir", next_due_date: "2026-10-20", amount_cents: 2000, categories: { icon: "house" } },
      { id: "due-null", space_id: "space-test", status: "active", name: "À venir sans icône", next_due_date: "2026-10-21", amount_cents: 100, categories: null },
      { id: "paid", space_id: "space-test", status: "active", name: "Payé", last_paid_date: "2026-10-10", amount_cents: 3000, categories: null },
      { id: "paid-icon", space_id: "space-test", status: "active", name: "Payé icône", last_paid_date: "2026-10-11", amount_cents: 500, categories: { icon: "house" } },
    ], shared_expenses: [{ space_id: "space-test", source_transaction_id: "shared", date: "2026-10-10", amount_cents: 1500, category_id: "food", categories: category, description: "Partagé" }] }, kind);
  }

  it("composes net KPIs, overlays, sorted budgets, goals and fixed charges without altering balances", async () => {
    richContext();
    const tree = await dashboard();
    expect(props(tree, PeriodSelector).current).toEqual({ type: "month", month: "2026-10" });
    expect(props(tree, ExpenseIncomeLine)).toMatchObject({ periodExpense: 7900, periodIncome: 20000 });
    expect(props(tree, ConsolidatedBalanceTile).amountCents).toBe(237100);
    expect(props(tree, RemainingToLive)).toMatchObject({ amountCents: 212100, afterChargesCents: 210000 });
    expect(props(tree, BudgetStackedChart).rows).toEqual([
      expect.objectContaining({ id: "large", consumed: 7000, amount: 10000 }), expect.objectContaining({ id: "small", consumed: 400, categoryName: null }),
    ]);
    expect(props(tree, ExpenseByCategoryWidget).transactionsByCategory).toEqual(expect.objectContaining({
      food: [expect.objectContaining({ id: "expense", amount_cents: -6000 }), expect.objectContaining({ id: "food-two", amount_cents: -1000 })],
    }));
    expect(Object.values(props(tree, ExpenseByCategoryWidget).transactionsByCategory as Record<string, Row[]>).flat()).toEqual(expect.arrayContaining([expect.objectContaining({ id: "none" })]));
    expect(props(tree, SavingsGoalsSummary).goals).toEqual(expect.arrayContaining([expect.objectContaining({ id: "linked", currentCents: 5000 })]));
    expect(props(tree, FixedChargesSummary)).toMatchObject({ totalCents: 2100, charges: [
      expect.objectContaining({ id: "due", paid: false, icon: "house" }), expect.objectContaining({ id: "due-null", paid: false, icon: null }),
      expect.objectContaining({ id: "paid", paid: true, icon: null }), expect.objectContaining({ id: "paid-icon", paid: true, icon: "house" }),
    ] });
    expect(props(tree, RecentTransactions).transactions).toEqual(expect.arrayContaining([expect.objectContaining({ id: "expense", amount_cents: -6000 })]));
  });

  it.each([undefined, "current", "", "saving,invalid"])("scopes shared activity and selected accounts for %s", async (accounts) => {
    richContext("shared");
    const tree = await dashboard({ accounts });
    expect(props(tree, ExpenseIncomeLine).periodExpense).toBe(accounts === undefined ? 9400 : accounts === "current" ? 7900 : 0);
    expect(props(tree, ConsolidatedBalanceTile).amountCents).toBe(237100);
    expect(props(tree, AccountSelector).selectedIds).toEqual(accounts === undefined ? ["current", "other"] : accounts === "current" ? ["current"] : []);
    expect(tree.some((node) => node.type === T && node.props.k === (accounts === undefined ? "dashboard.sharedNote" : "dashboard.sharedNoteFiltered"))).toBe(true);
    if (accounts === "") expect(props(tree, RemainingToLive)).toMatchObject({ amountCents: 0, afterChargesCents: 0 });
  });

  it("handles December rollover and an all-history period", async () => {
    vi.setSystemTime(new Date("2026-12-15T12:00:00Z"));
    context({ accounts: [account()], transactions: [tx("old", -1000), tx("dec", -2000, { date: "2026-12-10" })] });
    expect(props(await dashboard({ period: "tout" }), ExpenseIncomeLine).periodExpense).toBe(3000);
  });

  it("renders empty states on null query results", async () => {
    context({ accounts: null, transactions: null, budgets: null, savings_goals: null, fixed_charges: null });
    const tree = await dashboard();
    expect(props(tree, ConsolidatedBalanceTile).amountCents).toBe(0);
    expect(props(tree, ExpenseIncomeLine)).toMatchObject({ periodExpense: 0, periodIncome: 0 });
    expect(props(tree, BudgetStackedChart).rows).toEqual([]);
    expect(props(tree, RecentTransactions).transactions).toEqual([]);
  });
});

describe("accounts server pages coverage", () => {
  it("renders grouped cards with net monthly expenses and gross anchored balance", async () => {
    const transactions = [tx("expense", -9000), tx("refund", 3000, { reimburses_transaction_id: "expense" }), tx("salary", 20000), tx("deleted", -8000, { deleted_at: "2026-10-10" }), tx("old", -1000, { date: "2025-12-01" }), tx("prior-month", -2000, { date: "2026-09-01" })];
    context({ accounts: [account("current", { transactions }), account("empty", { transactions: null, bank: null })], transactions });
    const tree = elements(await AccountsPage({ searchParams: Promise.resolve({ bank: "Banque fictive" }) }));
    const list = props(tree, AccountsList);
    expect(list.selectedBank).toBe("Banque fictive");
    expect(JSON.stringify(list.groups)).toContain('"balanceCents":112000');
    expect(JSON.stringify(list.groups)).toContain('"monthExpenseCents":6000');
    expect((list.importButton as Element).props).toMatchObject({ spaceKind: "personal", hasAccount: true });
  });

  it("renders no accounts on a null result and disables account-dependent import", async () => {
    context({ accounts: null }, "shared");
    const list = props(elements(await AccountsPage({ searchParams: Promise.resolve({}) })), AccountsList);
    expect(list.groups).toEqual([]);
    expect((list.importButton as Element).props).toEqual({ spaceKind: "shared", hasAccount: false });
  });

  it("returns notFound for a missing or inaccessible account", async () => {
    context({ accounts: [account("other-space", { space_id: "another-space" })] });
    await expect(AccountDetailPage({ params: Promise.resolve({ id: "other-space" }), searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledOnce();
  });

  it("normalizes embedded categories, sorts same-day rows and keeps refunds out of activity but not balances", async () => {
    const transactions = [
      tx("expense", -9000, { categories: [category], notes: "note" }), tx("refund", 3000, { reimburses_transaction_id: "expense", categories: [] }),
      tx("z", -1000, { categories: null }), tx("a", -500, { categories: { name: "Sans couleur", color: null, icon: null } }),
      tx("old", -1000, { date: "2025-12-01" }),
    ];
    context({ accounts: [account()], transactions }, "shared");
    const result = await AccountDetailPage({ params: Promise.resolve({ id: "current" }), searchParams: Promise.resolve({ month: "2026-09" }) });
    expect(result.props).toMatchObject({ balanceCents: 92500, spaceKind: "shared", initialPeriod: "2026-09" });
    expect(result.props.allTransactions.map((row: Row) => row.id)).toEqual(["z", "refund", "expense", "a", "old"]);
    expect(result.props.allTransactions.find((row: Row) => row.id === "expense")).toMatchObject({ amount_cents: -6000, gross_cents: -9000, categories: category, notes: "note" });
    expect(result.props.allTransactions.find((row: Row) => row.id === "refund")).toMatchObject({ categories: null, notes: null });
    expect(result.props.balanceTxs).toEqual(expect.arrayContaining([{ date: "2026-10-10", amount_cents: -9000 }, { date: "2026-10-10", amount_cents: 3000 }]));
    expect(result.props.expenseHistory).toEqual(expect.arrayContaining([expect.objectContaining({ amount_cents: -6000, categoryName: "Courses test" }), expect.objectContaining({ amount_cents: -1000, categoryName: null })]));
  });

  it.each([{}, { period: "6m", month: "2026-09" }])("handles null history and period precedence %j", async (search) => {
    context({ accounts: [account()], transactions: null });
    const result = await AccountDetailPage({ params: Promise.resolve({ id: "current" }), searchParams: Promise.resolve(search) });
    expect(result.props.balanceCents).toBe(100000);
    expect(result.props.allTransactions).toEqual([]);
    expect(result.props.initialPeriod).toBe("period" in search ? "6m" : "2026-10");
  });
});
