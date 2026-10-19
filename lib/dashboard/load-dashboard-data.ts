import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

import { computeExpenseByCategory } from "@/lib/accounts/compute-expense-by-category";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { groupAccountBalancesByBank, type AccountBalance } from "@/lib/accounts/group-account-balances";
import { runScopedQuery } from "@/lib/accounts/run-scoped-query";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";
import { currentMonth, floorMonthWindow, parsePeriodParam, periodBounds, todayISO } from "@/lib/dates/period";
import { resolveEarliestTransactionDate } from "@/lib/dates/resolve-earliest-transaction-date";
import { resolveGoalCurrentCents } from "@/lib/savings-goals/resolve-current-amount";
import { fetchSharedExpenseActivity, type ActivityRange, type ActivityRow } from "@/lib/shared-expenses/activity-rows";
import { unwrap } from "@/lib/supabase/unwrap";
import { fetchReimbursementIndex } from "@/lib/transactions/fetch-reimbursements";
import { applyReimbursements, netAmounts } from "@/lib/transactions/net-amount";

import { groupByCategoryId, sumAbsByCategoryId } from "./group-by-category";
import { computeSavingsThisMonthCents } from "./savings-this-month";

/**
 * Rows fetched raw (never summed) for what needs individual lines: the click-to-open
 * overlays and the recent-transactions feed. Totals come from the SQL aggregates
 * (migration 20261020090000), so these caps never alter a figure — they only bound
 * how many lines an overlay can list (issue 162).
 */
export const RECENT_TRANSACTIONS_LIMIT = 200;
export const OVERLAY_ROWS_LIMIT = 500;

type CategoryJoin = {
  name: string;
  color: string | null;
  icon: string | null;
  is_default: boolean;
  translation_key: string | null;
};

type CategoryTotalRow = Database["public"]["Functions"]["dashboard_category_totals"]["Returns"][number];
type MonthlyTotalRow = Database["public"]["Functions"]["dashboard_monthly_totals"]["Returns"][number];

type RawOverlayRow = {
  id: string;
  date: string;
  description: string | null;
  kind: string;
  amount_cents: number;
  category_id: string | null;
};

export interface DashboardParams {
  supabase: SupabaseClient<Database>;
  spaceId: string;
  spaceKind: string;
  searchParams: { period?: string; accounts?: string };
  now?: Date;
}

/** Everything the dashboard page renders; the page itself only lays it out. */
export type DashboardData = Awaited<ReturnType<typeof loadDashboardData>>;

const monthBounds = (now: Date) => {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${year}-${pad(month)}-01`;
  const nextMonthStart = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { monthStart, nextMonthStart, monthEnd: `${year}-${pad(month)}-${pad(lastDay)}` };
};

/** Turns aggregated rows back into the pseudo-transactions the shared `compute*` helpers take. */
const monthlyRowsToTransactions = (rows: MonthlyTotalRow[]) =>
  rows.map((row) => ({ id: `${row.month}:${row.kind}`, date: `${row.month}-01`, kind: row.kind, amount_cents: Number(row.total_cents) }));

export async function loadDashboardData({ supabase, spaceId, spaceKind, searchParams, now = new Date() }: DashboardParams) {
  const { monthStart, nextMonthStart, monthEnd } = monthBounds(now);
  const todayStr = todayISO(now);
  const { period: periodParam, accounts: accountsParam } = searchParams;

  // `?accounts=` absent = every courant account; present-but-empty = none selected
  // (a distinct state, see build-dashboard-href.ts). Compared with `undefined`, not falsiness.
  const requestedAccountIdSet = accountsParam !== undefined ? new Set(accountsParam.split(",").filter(Boolean)) : null;
  // Shared expenses sit on no account: only shown with the selector on "Tous les comptes".
  const includeShared = spaceKind === "shared" && accountsParam === undefined;
  const sharedActivity = (range: ActivityRange): Promise<ActivityRow[]> =>
    includeShared ? fetchSharedExpenseActivity(supabase, spaceId, range) : Promise.resolve([]);

  const period = parsePeriodParam(periodParam, now);
  const isAllTime = period.type === "preset" && period.value === "tout";

  // ── Round 1: everything that does not depend on the account list ─────────
  // (accounts are fetched in parallel with the aggregates, which scope on
  // space_id and join `accounts` in SQL, instead of waiting for accountIds).
  const [accountsRes, budgetsRes, goalsRes, fixedChargesRes, paidFixedChargesRes, accountTotalsRes, goalTotalsRes, savingsRes, reimbursements] =
    await Promise.all([
      supabase
        .from("accounts")
        .select("id, name, type, bank, initial_balance_cents, balance_anchor_date")
        .eq("space_id", spaceId)
        .is("deleted_at", null),
      supabase
        .from("budgets")
        .select("id, category_id, amount_cents, categories(name, color, icon, is_default, translation_key)")
        .eq("space_id", spaceId)
        .eq("month", monthStart)
        .is("deleted_at", null),
      supabase
        .from("savings_goals")
        .select("id, name, target_amount_cents, current_amount_cents, color, icon, linked_category_id")
        .eq("space_id", spaceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("fixed_charges")
        .select("id, name, amount_cents, next_due_date, categories(icon)")
        .eq("space_id", spaceId)
        .eq("status", "active")
        .gte("next_due_date", todayStr)
        .lte("next_due_date", monthEnd)
        .is("deleted_at", null)
        .order("next_due_date", { ascending: true }),
      // Active fixed charges already marked paid this month (set by POST /api/fixed-charges/:id/pay).
      supabase
        .from("fixed_charges")
        .select("id, name, amount_cents, last_paid_date, categories(icon)")
        .eq("space_id", spaceId)
        .eq("status", "active")
        .gte("last_paid_date", monthStart)
        .lte("last_paid_date", todayStr)
        .is("deleted_at", null)
        .order("last_paid_date", { ascending: false }),
      // Per-account sum after each account's anchor (ADR 0003), exact beyond 1000 rows.
      supabase.rpc("dashboard_account_totals", { p_space_id: spaceId }),
      supabase.rpc("dashboard_goal_category_totals", { p_space_id: spaceId }),
      // "Épargne ce mois": non-courant accounts, real current month, all kinds.
      supabase.rpc("dashboard_net_cents", { p_space_id: spaceId, p_scope: "non_courant", p_from: monthStart, p_to: nextMonthStart }),
      // Issue 123 (ADR 0004): reimbursement links of the space, never windowed.
      fetchReimbursementIndex(supabase, spaceId),
    ]);

  const accounts = unwrap(accountsRes) ?? [];
  const budgets = unwrap(budgetsRes) ?? [];
  const goals = unwrap(goalsRes) ?? [];
  const upcomingFixedCharges = unwrap(fixedChargesRes) ?? [];
  const paidFixedCharges = unwrap(paidFixedChargesRes) ?? [];
  const accountTotalRows = unwrap(accountTotalsRes) ?? [];
  const goalTotalRows = unwrap(goalTotalsRes) ?? [];
  const savingsThisMonthCents = computeSavingsThisMonthCents([{ amount_cents: Number(unwrap(savingsRes) ?? 0) }]);

  // Courant accounts + the account selector: every "activity" stat is scoped to the
  // selected courant accounts; snapshots (balances, savings, goals) use every active account.
  // CAUTION when adding a query: `accounts` (snapshot) vs `selectedCourantIds` (activity)
  // are both plain string lists — copy whichever an existing query of the same kind uses.
  const courantAccounts = accounts.filter((a) => a.type === "courant").map((a) => ({ id: a.id, name: a.name }));
  const courantAccountIds = courantAccounts.map((a) => a.id);
  const selectedCourantIds = requestedAccountIdSet
    ? courantAccountIds.filter((id) => requestedAccountIdSet.has(id))
    : courantAccountIds;
  const selectedCourantIdSet = new Set(selectedCourantIds);

  // "tout" needs the earliest transaction date to bound its range.
  const earliestDate = isAllTime
    ? await resolveEarliestTransactionDate(supabase, spaceId, selectedCourantIds, { includeSharedExpenses: includeShared })
    : null;
  const { from: periodFrom, to: periodTo, monthCount: periodMonthCount } = periodBounds(period, { now, earliestDate });
  const periodToMonth = periodTo.slice(0, 7);
  const currentMonthValue = currentMonth(now);
  // The trend always shows at least 6 months; the period can only widen it.
  const { from: trendFrom, monthCount: trendMonthCount, isFloored: trendIsFloored } = floorMonthWindow(
    periodFrom,
    periodMonthCount,
    6,
    now,
    periodToMonth,
  );

  const budgetCatIds = budgets.map((b) => b.category_id).filter(Boolean);

  const rpcArgs = (from: string, to: string, toInclusive: boolean) => ({
    p_space_id: spaceId,
    p_scope: "courant",
    p_account_ids: selectedCourantIds,
    p_from: from,
    p_to: to,
    p_to_inclusive: toInclusive,
  });

  // ── Round 2: period-dependent aggregates + the raw lines the overlays need ─
  const [periodTotalsRes, trendTotalsRes, budgetTotalsRes, overlayRes, recentTxRes, budgetOverlayRes, sharedPeriodRows, sharedTrendRows, sharedBudgetRows] =
    await Promise.all([
      // KPI + donut: one row per (category, kind), summed in SQL.
      runScopedQuery<CategoryTotalRow>([selectedCourantIds], () =>
        supabase.rpc("dashboard_category_totals", rpcArgs(periodFrom, periodTo, true)),
      ),
      // Income/expense trend (at least 6 months — see trendFrom), one row per (month, kind).
      runScopedQuery<MonthlyTotalRow>([selectedCourantIds], () =>
        supabase.rpc("dashboard_monthly_totals", rpcArgs(trendFrom, periodTo, true)),
      ),
      // Budget consumption of the real current month, one row per (category, kind).
      runScopedQuery<CategoryTotalRow>([selectedCourantIds, budgetCatIds], () =>
        supabase.rpc("dashboard_category_totals", rpcArgs(monthStart, nextMonthStart, false)),
      ),
      // Donut overlay: the period's expense lines, most recent first, explicitly capped.
      runScopedQuery<RawOverlayRow>([selectedCourantIds], () =>
        supabase
          .from("transactions")
          .select("id, date, description, kind, amount_cents, category_id")
          .eq("space_id", spaceId)
          .in("account_id", selectedCourantIds)
          .eq("kind", "expense")
          .gte("date", periodFrom)
          .lte("date", periodTo)
          .is("deleted_at", null)
          .order("date", { ascending: false })
          .limit(OVERLAY_ROWS_LIMIT),
      ),
      // "Dernières transactions": every kind, period-scoped, most recent first.
      runScopedQuery<{
        id: string;
        account_id: string;
        amount_cents: number;
        date: string;
        description: string | null;
        kind: string;
        categories: Pick<CategoryJoin, "name" | "is_default" | "translation_key"> | null;
      }>([selectedCourantIds], () =>
        supabase
          .from("transactions")
          .select("id, account_id, amount_cents, date, description, kind, categories(name, is_default, translation_key)")
          .eq("space_id", spaceId)
          .in("account_id", selectedCourantIds)
          .is("deleted_at", null)
          .gte("date", periodFrom)
          .lte("date", periodTo)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(RECENT_TRANSACTIONS_LIMIT),
      ),
      // Budget overlay: this month's expense lines of the budgeted categories, capped.
      runScopedQuery<{ id: string; date: string; description: string | null; category_id: string | null; amount_cents: number }>(
        [selectedCourantIds, budgetCatIds],
        () =>
          supabase
            .from("transactions")
            .select("id, date, description, category_id, amount_cents")
            .eq("space_id", spaceId)
            .eq("kind", "expense")
            .in("account_id", selectedCourantIds)
            .in("category_id", budgetCatIds)
            .gte("date", monthStart)
            .lt("date", nextMonthStart)
            .is("deleted_at", null)
            .order("date", { ascending: false })
            .limit(OVERLAY_ROWS_LIMIT),
      ),
      // Shared expenses (shared spaces only, outside runScopedQuery on purpose: a
      // shared space may have shared expenses but no account).
      sharedActivity({ from: periodFrom, to: periodTo }),
      sharedActivity({ from: trendFrom, to: periodTo }),
      sharedActivity({ from: monthStart, to: nextMonthStart, toInclusive: false, categoryIds: budgetCatIds }),
    ]);

  const periodTotals = (unwrap(periodTotalsRes) ?? []) as CategoryTotalRow[];
  const trendTotals = (unwrap(trendTotalsRes) ?? []) as MonthlyTotalRow[];
  const budgetTotals = (unwrap(budgetTotalsRes) ?? []) as CategoryTotalRow[];
  const overlayRows = unwrap(overlayRes) ?? [];
  const recentTx = unwrap(recentTxRes) ?? [];
  const budgetOverlayRows = unwrap(budgetOverlayRes) ?? [];

  // ── Balances: initial + own transactions after the anchor, per account ───
  const totalByAccountId = new Map(accountTotalRows.map((r) => [r.account_id, Number(r.total_cents)]));
  const accountBalances: AccountBalance[] = accounts.map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    bank: acc.bank,
    balanceCents: acc.initial_balance_cents + (totalByAccountId.get(acc.id) ?? 0),
  }));
  const consolidatedBalance = accountBalances.reduce((sum, acc) => sum + acc.balanceCents, 0);
  const bankGroups = groupAccountBalancesByBank(accountBalances);

  // ── "Reste à vivre" ──────────────────────────────────────────────────────
  const courantBalanceCents = accountBalances.filter((a) => selectedCourantIdSet.has(a.id)).reduce((sum, a) => sum + a.balanceCents, 0);
  const upcomingFixedChargesCents = upcomingFixedCharges.reduce((sum, fc) => sum + fc.amount_cents, 0);
  // Upcoming charges aren't account-scoped: with no account selected they would
  // read as "overdrawn" rather than "nothing selected" — zero them in that case.
  const remainingToLiveAfterChargesCents = selectedCourantIds.length === 0 ? 0 : courantBalanceCents - upcomingFixedChargesCents;

  // Upcoming rows first (sorted by due date), paid ones after (most recent first).
  const fixedChargeRows = [
    ...upcomingFixedCharges.map((fc) => ({
      id: fc.id,
      name: fc.name,
      amount_cents: fc.amount_cents,
      date: fc.next_due_date,
      icon: fc.categories?.icon ?? null,
      paid: false as const,
    })),
    ...paidFixedCharges.map((fc) => ({
      id: fc.id,
      name: fc.name,
      amount_cents: fc.amount_cents,
      date: fc.last_paid_date as string,
      icon: fc.categories?.icon ?? null,
      paid: true as const,
    })),
  ];

  // ── Period KPIs: SQL totals (already net of reimbursements) + shared expenses ─
  // Shared rows are netted by the reimbursement index exactly as before.
  const sharedPeriod = applyReimbursements(sharedPeriodRows, reimbursements);
  const periodExpense =
    periodTotals.filter((r) => r.kind === "expense").reduce((s, r) => s + Number(r.total_cents), 0) +
    sharedPeriod.reduce((s, r) => s + Math.abs(r.amount_cents), 0);
  const periodIncome = periodTotals.filter((r) => r.kind === "income").reduce((s, r) => s + Number(r.total_cents), 0);

  // ── Donut: aggregated rows fed to the shared, tested helper ──────────────
  const expenseTotals = periodTotals.filter((r) => r.kind === "expense");
  const categoryMetaById = new Map<string, CategoryJoin | null>();
  const donutInput = [
    ...expenseTotals.map((r) => {
      if (r.category_id) {
        categoryMetaById.set(r.category_id, r.name ? { name: r.name, color: r.color, icon: r.icon, is_default: Boolean(r.is_default), translation_key: r.translation_key } : null);
      }
      return { amount_cents: Number(r.total_cents), categoryName: r.name, categoryColor: r.color, categoryIcon: r.icon, categoryId: r.category_id };
    }),
    ...sharedPeriod.map((tx) => {
      const cat = tx.categories;
      if (tx.category_id) categoryMetaById.set(tx.category_id, cat);
      return { amount_cents: tx.amount_cents, categoryName: cat?.name ?? null, categoryColor: cat?.color ?? null, categoryIcon: cat?.icon ?? null, categoryId: tx.category_id };
    }),
  ];
  const donutDataWithMeta = computeExpenseByCategory(donutInput).map((point) => {
    const meta = point.categoryId ? categoryMetaById.get(point.categoryId) : null;
    return { ...point, is_default: meta?.is_default ?? false, translation_key: meta?.translation_key ?? null };
  });

  // Overlay lines (capped, net of reimbursements like the totals) + the shared expenses.
  const overlayExpenseTx = applyReimbursements([...overlayRows, ...sharedPeriod], reimbursements);
  const donutTransactionsByCategory = groupByCategoryId(overlayExpenseTx);
  const uncategorizedExpenseTx = overlayExpenseTx
    .filter((tx) => !tx.category_id)
    .map((tx) => ({ id: tx.id, date: tx.date, description: tx.description, amount_cents: tx.amount_cents }));
  if (uncategorizedExpenseTx.length > 0) {
    donutTransactionsByCategory[UNCATEGORIZED_CATEGORY_ID] = uncategorizedExpenseTx;
  }

  // ── Trend ────────────────────────────────────────────────────────────────
  const barData = computeIncomeExpenseSeries(
    [...monthlyRowsToTransactions(trendTotals), ...applyReimbursements(sharedTrendRows, reimbursements)],
    trendMonthCount,
    now,
    periodToMonth,
  );

  // ── Budgets ──────────────────────────────────────────────────────────────
  const budgetConsumption = sumAbsByCategoryId([
    ...budgetTotals.filter((r) => r.kind === "expense").map((r) => ({ category_id: r.category_id, amount_cents: Number(r.total_cents) })),
    ...applyReimbursements(sharedBudgetRows, reimbursements),
  ]);
  const budgetTransactionsByCategory = groupByCategoryId(applyReimbursements([...budgetOverlayRows, ...sharedBudgetRows], reimbursements));
  const budgetRows = budgets
    .map((b) => {
      const category = b.categories;
      return {
        id: b.id,
        categoryId: b.category_id,
        // `null` when uncategorized — BudgetStackedChart (client) supplies the translated fallback.
        categoryName: category?.name ?? null,
        categoryIcon: category?.icon ?? null,
        categoryColor: category?.color ?? null,
        isDefault: category?.is_default ?? false,
        translationKey: category?.translation_key ?? null,
        amount: b.amount_cents,
        consumed: budgetConsumption[b.category_id] ?? 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // ── Savings goals ────────────────────────────────────────────────────────
  const goalCategoryTotals = sumAbsByCategoryId(goalTotalRows.map((r) => ({ category_id: r.category_id, amount_cents: Number(r.total_abs_cents) })));
  const goalSummaries = goals.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    color: g.color,
    currentCents: resolveGoalCurrentCents(g, goalCategoryTotals),
    targetCents: g.target_amount_cents,
  }));

  const recentTransactions = netAmounts(recentTx, reimbursements).map((tx) => ({
    id: tx.id,
    amount_cents: tx.amount_cents,
    date: tx.date,
    description: tx.description,
    kind: tx.kind,
    categories: tx.categories,
  }));

  return {
    period,
    periodParam,
    accountsParam,
    includeShared,
    currentMonthValue,
    courantAccounts,
    selectedCourantIds,
    consolidatedBalance,
    bankGroups,
    courantBalanceCents,
    remainingToLiveAfterChargesCents,
    savingsThisMonthCents,
    periodExpense,
    periodIncome,
    donutData: donutDataWithMeta,
    donutTransactionsByCategory,
    barData,
    trendIsFloored,
    budgetRows,
    budgetTransactionsByCategory,
    fixedChargeRows,
    upcomingFixedChargesCents,
    goalSummaries,
    recentTransactions,
  };
}
