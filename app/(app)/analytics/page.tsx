import type { ReactNode } from "react";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PeriodSelector } from "@/components/period-selector";
import { T } from "@/components/i18n/t";
import { AnalyticsTabs, ANALYTICS_TABS, type AnalyticsTab } from "@/components/analytics/analytics-tabs";
import { NetWorthChart } from "@/components/analytics/net-worth-chart";
import { CashflowChart } from "@/components/analytics/cashflow-chart";
import { ExpenseTrendChart } from "@/components/analytics/expense-trend-chart";
import { SavingsRateChart } from "@/components/analytics/savings-rate-chart";
import { CategoryTrendChart } from "@/components/analytics/category-trend-chart";
import { CategoryBreakdownToggle } from "@/components/analytics/category-breakdown-toggle";
import { BudgetVsActualChart } from "@/components/analytics/budget-vs-actual-chart";
import { TopCategoriesMerchants, type TopCategoryRow, type TopMerchantRow } from "@/components/analytics/top-categories-merchants";
import { AccountBalanceBreakdownChart } from "@/components/analytics/account-balance-breakdown-chart";
import { FixedChargesShareStat } from "@/components/analytics/fixed-charges-share-stat";
import { AmountHistogramChart } from "@/components/analytics/amount-histogram-chart";
import { ExpenseCalendarHeatmap, type DailyExpensePoint } from "@/components/analytics/expense-calendar-heatmap";
import { YearOverYearChart } from "@/components/analytics/year-over-year-chart";
import { GoalProgressChart } from "@/components/analytics/goal-progress-chart";
import { computeBalanceSeries } from "@/lib/accounts/compute-balance-series";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { computeTransferVolumeSeries } from "@/lib/accounts/compute-transfer-volume-series";
import { computeCategoryTrendSeries } from "@/lib/accounts/compute-category-trend-series";
import { computeExpenseByCategory } from "@/lib/accounts/compute-expense-by-category";
import { computeAmountHistogram } from "@/lib/accounts/compute-amount-histogram";
import { computeYearOverYear } from "@/lib/accounts/compute-year-over-year";
import { groupAccountBalancesByBank, type AccountBalance } from "@/lib/accounts/group-account-balances";
import { runScopedQuery } from "@/lib/accounts/run-scoped-query";
import { resolveGoalCurrentCents } from "@/lib/savings-goals/resolve-current-amount";
import { computeGoalProgressSeries } from "@/lib/savings-goals/compute-goal-progress-series";
import { addMonths, parsePeriodParam, periodBounds, periodLabel as resolvePeriodLabel, todayISO } from "@/lib/dates/period";
import { resolveEarliestTransactionDate } from "@/lib/dates/resolve-earliest-transaction-date";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";

type CategoryJoin = { name: string; color: string | null; icon: string | null; is_default: boolean; translation_key: string | null };

/** Every category-joined query result comes back typed `unknown` (Supabase's embed typing) — one cast site instead of repeating `as unknown as CategoryJoin | null` at every call. */
function toCategoryMeta(raw: unknown): CategoryJoin | null {
  return raw as unknown as CategoryJoin | null;
}

/** One `<DashboardCard>` + heading, reused by every chart section below instead of repeating the same wrapper markup 10 times. */
function Section({ titleKey, vars, children }: { titleKey: string; vars?: Record<string, string | number>; children: ReactNode }) {
  return (
    <DashboardCard>
      <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        <T k={titleKey} vars={vars} />
      </h2>
      {children}
    </DashboardCard>
  );
}

/**
 * "/analytics" — bac à sable de graphiques (issue #36), segmenté en onglets
 * navigués par `?tab=` (chaque onglet ne fetch/rend que ses propres
 * données — cible PRD < 2s, voir components/analytics/analytics-tabs.tsx).
 * "Vue d'ensemble" garde le comportement historique (plan §Étape 4) : 3
 * graphiques scopés par `PeriodSelector`. Les autres onglets ajoutent les
 * pistes listées dans #36 (patrimoine net et cash-flow restent uniques à
 * "Vue d'ensemble").
 *
 * Changer de préréglage de période réinitialise l'onglet à "Vue d'ensemble"
 * (PeriodSelector ne transmet pas `?tab=` — composant partagé avec
 * /dashboard, pas étendu pour ce seul cas) : compromis assumé plutôt que de
 * complexifier un composant partagé pour un confort mineur.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const now = new Date();

  const { period: periodParam, tab: tabParam } = await searchParams;
  const tab: AnalyticsTab = (ANALYTICS_TABS as string[]).includes(tabParam ?? "") ? (tabParam as AnalyticsTab) : "overview";
  const showPeriodSelector = tab === "overview" || tab === "categories" || tab === "comparisons";

  // Active accounts — every tab needs at least the id list.
  const accountsRes = await supabase
    .from("accounts")
    .select("id, name, type, bank, initial_balance_cents")
    .is("deleted_at", null);
  const accounts = accountsRes.data ?? [];
  const accountIds = accounts.map((a) => a.id);

  const currentMonthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthStart = `${currentMonthValue}-01`;
  const currentMonthEnd = `${currentMonthValue}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  const todayStr = todayISO(now);

  // Period resolution (including resolveEarliestTransactionDate's own
  // query for "tout") only runs for the tabs that actually show
  // PeriodSelector — "accounts" and "transactions" use their own
  // always-current-month window instead (currentMonthStart/-End above),
  // so they'd otherwise pay for an unneeded query on every load just
  // because `?period=` happens to be present in the URL.
  const period = parsePeriodParam(periodParam ?? "6m", now);
  let windowFrom = currentMonthStart;
  let windowTo = currentMonthEnd;
  let windowMonthCount: number | null = 1;
  let windowLabel = "";
  if (showPeriodSelector) {
    const earliestDate =
      period.type === "preset" && period.value === "tout"
        ? await resolveEarliestTransactionDate(supabase, accountIds)
        : null;
    ({ from: windowFrom, to: windowTo, monthCount: windowMonthCount } = periodBounds(period, { now, earliestDate }));
    windowLabel = resolvePeriodLabel(period, now);
  }
  const windowToMonth = windowTo.slice(0, 7);

  let tabContent: ReactNode = null;

  if (tab === "overview") {
    const [allTxRes, windowTxRes, transferTxRes] = await Promise.all([
      runScopedQuery<{ amount_cents: number; date: string }>([accountIds], () =>
        supabase.from("transactions").select("amount_cents, date").in("account_id", accountIds).is("deleted_at", null),
      ),
      runScopedQuery<{ kind: string; amount_cents: number; date: string }>([accountIds], () =>
        supabase
          .from("transactions")
          .select("kind, amount_cents, date")
          .in("account_id", accountIds)
          .in("kind", ["expense", "income"])
          .is("deleted_at", null)
          .gte("date", windowFrom)
          .lte("date", windowTo),
      ),
      runScopedQuery<{ amount_cents: number; date: string }>([accountIds], () =>
        supabase
          .from("transactions")
          .select("amount_cents, date")
          .in("account_id", accountIds)
          .eq("kind", "transfer_debit")
          .is("deleted_at", null)
          .gte("date", windowFrom)
          .lte("date", windowTo),
      ),
    ]);

    const initialBalanceTotal = accounts.reduce((sum, a) => sum + a.initial_balance_cents, 0);
    const fullNetWorthSeries = computeBalanceSeries(allTxRes.data ?? [], initialBalanceTotal, now, windowToMonth);
    const netWorthSeries = windowMonthCount === null ? fullNetWorthSeries : fullNetWorthSeries.slice(-windowMonthCount);
    const windowSeries = computeIncomeExpenseSeries(windowTxRes.data ?? [], windowMonthCount, now, windowToMonth);
    const transferSeries = computeTransferVolumeSeries(transferTxRes.data ?? [], windowMonthCount, now, windowToMonth);

    tabContent = (
      <>
        <Section titleKey="analytics.netWorth.heading" vars={{ period: windowLabel }}>
          <NetWorthChart data={netWorthSeries} />
        </Section>

        <Section titleKey="analytics.cashflow.heading" vars={{ period: windowLabel }}>
          <CashflowChart data={windowSeries} transferData={transferSeries} />
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          <Section titleKey="analytics.expenseTrend.heading" vars={{ period: windowLabel }}>
            <ExpenseTrendChart data={windowSeries} />
          </Section>

          <Section titleKey="analytics.savingsRate.heading" vars={{ period: windowLabel }}>
            <SavingsRateChart data={windowSeries} />
          </Section>
        </div>
      </>
    );
  } else if (tab === "categories") {
    const yearStart = `${now.getFullYear()}-01-01`;

    const [categoryTxRes, budgetsRes, yearExpenseTxRes] = await Promise.all([
      // Window-bounded expense transactions with category info — feeds the
      // trend chart and the top-categories/merchants lists.
      runScopedQuery<{
        date: string;
        description: string | null;
        amount_cents: number;
        category_id: string | null;
        categories: unknown;
      }>([accountIds], () =>
        supabase
          .from("transactions")
          .select("date, description, amount_cents, category_id, categories(name, color, icon, is_default, translation_key)")
          .in("account_id", accountIds)
          .eq("kind", "expense")
          .is("deleted_at", null)
          .gte("date", windowFrom)
          .lte("date", windowTo),
      ),
      supabase
        .from("budgets")
        .select("id, category_id, amount_cents, categories(name, color, icon, is_default, translation_key)")
        .eq("month", currentMonthStart)
        .is("deleted_at", null),
      // Year-to-date expense transactions — feeds both the "cumul annuel"
      // side of the toggle and (filtered down) the "mois courant" side, one
      // query instead of two since the month is always inside the year.
      runScopedQuery<{ amount_cents: number; date: string; category_id: string | null; categories: unknown }>(
        [accountIds],
        () =>
          supabase
            .from("transactions")
            .select("amount_cents, date, category_id, categories(name, color, icon, is_default, translation_key)")
            .in("account_id", accountIds)
            .eq("kind", "expense")
            .is("deleted_at", null)
            .gte("date", yearStart)
            .lte("date", todayStr),
      ),
    ]);

    const categoryTx = categoryTxRes.data ?? [];
    const trendSeries = computeCategoryTrendSeries(
      categoryTx.map((tx) => {
        const cat = toCategoryMeta(tx.categories);
        return {
          date: tx.date,
          amount_cents: tx.amount_cents,
          categoryId: tx.category_id,
          categoryName: cat?.name ?? null,
          categoryColor: cat?.color ?? null,
          categoryIsDefault: cat?.is_default,
          categoryTranslationKey: cat?.translation_key,
        };
      }),
      windowMonthCount,
      now,
      windowToMonth,
    );

    // Budget vs réalisé (mois en cours) — same shape as the dashboard's
    // budget widget, consumption computed from the year-to-date query
    // (already fetched) rather than a 4th round-trip.
    const yearExpenseTx = yearExpenseTxRes.data ?? [];
    const monthExpenseTx = yearExpenseTx.filter((tx) => tx.date >= currentMonthStart);
    const consumedByCategory = new Map<string, number>();
    for (const tx of monthExpenseTx) {
      if (!tx.category_id) continue;
      consumedByCategory.set(tx.category_id, (consumedByCategory.get(tx.category_id) ?? 0) + Math.abs(tx.amount_cents));
    }
    const budgetRows = (budgetsRes.data ?? []).map((b) => {
      const cat = toCategoryMeta(b.categories);
      return {
        id: b.id,
        categoryName: cat?.name ?? null,
        categoryIcon: cat?.icon ?? null,
        isDefault: cat?.is_default ?? false,
        translationKey: cat?.translation_key ?? null,
        amount: b.amount_cents,
        consumed: consumedByCategory.get(b.category_id) ?? 0,
      };
    });

    // Répartition mois courant / cumul annuel. `computeExpenseByCategory`
    // groups by raw name and drops is_default/translation_key (same
    // limitation the dashboard works around — see app/(app)/dashboard/
    // page.tsx's `donutDataWithMeta`) — re-attach them here via categoryId
    // so CategoryBreakdownToggle can resolve each slice's translated name.
    const toDonutInput = (rows: typeof yearExpenseTx) =>
      rows.map((tx) => {
        const cat = toCategoryMeta(tx.categories);
        return { amount_cents: tx.amount_cents, categoryName: cat?.name ?? null, categoryColor: cat?.color ?? null, categoryIcon: cat?.icon ?? null, categoryId: tx.category_id };
      });
    const categoryMetaById = new Map(
      yearExpenseTx.filter((tx) => tx.category_id).map((tx) => [tx.category_id as string, toCategoryMeta(tx.categories)]),
    );
    const withDonutMeta = (points: ReturnType<typeof computeExpenseByCategory>) =>
      points.map((p) => {
        const meta = p.categoryId ? categoryMetaById.get(p.categoryId) : null;
        return { ...p, is_default: meta?.is_default ?? false, translation_key: meta?.translation_key ?? null };
      });
    const monthDonut = withDonutMeta(computeExpenseByCategory(toDonutInput(monthExpenseTx)));
    const yearDonut = withDonutMeta(computeExpenseByCategory(toDonutInput(yearExpenseTx)));

    // Top catégories (this window) & top marchands récurrents.
    const categoryTotals = new Map<string, TopCategoryRow>();
    const merchantTotals = new Map<string, TopMerchantRow>();
    for (const tx of categoryTx) {
      const cat = toCategoryMeta(tx.categories);
      const catKey = tx.category_id ?? UNCATEGORIZED_CATEGORY_ID;
      const existingCat = categoryTotals.get(catKey);
      categoryTotals.set(catKey, {
        name: cat?.name ?? "Sans catégorie",
        value: (existingCat?.value ?? 0) + Math.abs(tx.amount_cents),
        icon: cat?.icon ?? null,
        color: cat?.color ?? "var(--muted-foreground)",
        isDefault: cat?.is_default ?? false,
        translationKey: cat?.translation_key ?? null,
      });

      if (tx.description) {
        const existingMerchant = merchantTotals.get(tx.description);
        merchantTotals.set(tx.description, {
          description: tx.description,
          count: (existingMerchant?.count ?? 0) + 1,
          total: (existingMerchant?.total ?? 0) + Math.abs(tx.amount_cents),
        });
      }
    }
    const topCategories = [...categoryTotals.values()].sort((a, b) => b.value - a.value).slice(0, 5);
    const topMerchants = [...merchantTotals.values()]
      .filter((m) => m.count > 1) // "récurrents" — a one-off purchase isn't a recurring merchant
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    tabContent = (
      <>
        <Section titleKey="analytics.categoryTrend.heading" vars={{ period: windowLabel }}>
          <CategoryTrendChart data={trendSeries} />
        </Section>

        <div className="grid gap-4 md:grid-cols-2">
          <Section titleKey="analytics.categoryBreakdown.heading">
            <CategoryBreakdownToggle monthData={monthDonut} yearData={yearDonut} />
          </Section>

          <Section titleKey="analytics.budgetVsActual.heading">
            <BudgetVsActualChart rows={budgetRows} />
          </Section>
        </div>

        <Section titleKey="analytics.topCategories.heading" vars={{ period: windowLabel }}>
          <TopCategoriesMerchants topCategories={topCategories} topMerchants={topMerchants} />
        </Section>
      </>
    );
  } else if (tab === "accounts") {
    const [accountTxRes, fixedChargesRes] = await Promise.all([
      runScopedQuery<{ account_id: string; amount_cents: number }>([accountIds], () =>
        supabase.from("transactions").select("account_id, amount_cents").in("account_id", accountIds).is("deleted_at", null),
      ),
      supabase
        .from("fixed_charges")
        .select("amount_cents")
        .eq("status", "active")
        .gte("next_due_date", todayStr)
        .lte("next_due_date", currentMonthEnd)
        .is("deleted_at", null),
    ]);
    const accountTxTotals = (accountTxRes.data ?? []).reduce<Record<string, number>>((acc, tx) => {
      acc[tx.account_id] = (acc[tx.account_id] ?? 0) + tx.amount_cents;
      return acc;
    }, {});
    const accountBalances: AccountBalance[] = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      bank: a.bank,
      balanceCents: a.initial_balance_cents + (accountTxTotals[a.id] ?? 0),
    }));
    const bankGroups = groupAccountBalancesByBank(accountBalances);

    const courantAccountIdSet = new Set(accounts.filter((a) => a.type === "courant").map((a) => a.id));
    const courantBalanceCents = accountBalances
      .filter((a) => courantAccountIdSet.has(a.id))
      .reduce((sum, a) => sum + a.balanceCents, 0);
    const upcomingFixedChargesCents = (fixedChargesRes.data ?? []).reduce((sum, fc) => sum + fc.amount_cents, 0);

    tabContent = (
      <div className="grid gap-4 md:grid-cols-2">
        <Section titleKey="analytics.accountBreakdown.heading">
          <AccountBalanceBreakdownChart groups={bankGroups} />
        </Section>

        <Section titleKey="analytics.fixedChargesShare.heading">
          <FixedChargesShareStat courantBalanceCents={courantBalanceCents} upcomingFixedChargesCents={upcomingFixedChargesCents} />
        </Section>
      </div>
    );
  } else if (tab === "transactions") {
    const monthTxRes = await runScopedQuery<{ date: string; amount_cents: number }>([accountIds], () =>
      supabase
        .from("transactions")
        .select("date, amount_cents")
        .in("account_id", accountIds)
        .eq("kind", "expense")
        .is("deleted_at", null)
        .gte("date", currentMonthStart)
        .lte("date", currentMonthEnd),
    );
    const monthTx = monthTxRes.data ?? [];
    const histogram = computeAmountHistogram(monthTx);

    const totalsByDay = new Map<string, number>();
    for (const tx of monthTx) totalsByDay.set(tx.date, (totalsByDay.get(tx.date) ?? 0) + Math.abs(tx.amount_cents));
    const daysInMonth = Number(currentMonthEnd.slice(8, 10));
    const dailyPoints: DailyExpensePoint[] = Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${currentMonthStart.slice(0, 8)}${String(i + 1).padStart(2, "0")}`;
      return { date, amountCents: totalsByDay.get(date) ?? 0 };
    });

    tabContent = (
      <div className="grid gap-4 md:grid-cols-2">
        <Section titleKey="analytics.histogram.heading">
          <AmountHistogramChart data={histogram} />
        </Section>

        <Section titleKey="analytics.heatmap.heading">
          <ExpenseCalendarHeatmap days={dailyPoints} />
        </Section>
      </div>
    );
  } else {
    // comparisons
    const yoyMonthCount = windowMonthCount ?? 12;
    const yoyFrom = addMonths(windowFrom.slice(0, 7), -12) + "-01";

    const [yoyTxRes, goalsRes] = await Promise.all([
      // Only "expense" fetched: computeYearOverYear below is only ever
      // called with metric "expense", so an "income" row would just be
      // fetched and immediately discarded.
      runScopedQuery<{ date: string; kind: string; amount_cents: number }>([accountIds], () =>
        supabase
          .from("transactions")
          .select("date, kind, amount_cents")
          .in("account_id", accountIds)
          .eq("kind", "expense")
          .is("deleted_at", null)
          .gte("date", yoyFrom)
          .lte("date", windowTo),
      ),
      supabase
        .from("savings_goals")
        .select("id, name, target_amount_cents, current_amount_cents, color, linked_category_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);

    const yoyPoints = computeYearOverYear(yoyTxRes.data ?? [], yoyMonthCount, now, windowToMonth, "expense");

    const goals = goalsRes.data ?? [];
    const linkedCategoryIds = goals.map((g) => g.linked_category_id).filter((id): id is string => Boolean(id));
    const goalTxRes = await runScopedQuery<{ date: string; category_id: string | null; amount_cents: number }>(
      [accountIds, linkedCategoryIds],
      () =>
        supabase
          .from("transactions")
          .select("date, category_id, amount_cents")
          .in("account_id", accountIds)
          .in("category_id", linkedCategoryIds)
          .is("deleted_at", null),
    );
    const { points: goalPoints, series: goalSeries } = computeGoalProgressSeries(
      goalTxRes.data ?? [],
      goals,
      windowMonthCount,
      now,
      windowToMonth,
    );
    const goalCategoryTotals = new Map<string, number>();
    for (const tx of goalTxRes.data ?? []) {
      if (!tx.category_id) continue;
      goalCategoryTotals.set(tx.category_id, (goalCategoryTotals.get(tx.category_id) ?? 0) + Math.abs(tx.amount_cents));
    }
    const manualGoals = goals
      .filter((g) => !g.linked_category_id)
      .map((g) => ({
        id: g.id,
        name: g.name,
        currentCents: resolveGoalCurrentCents(g, Object.fromEntries(goalCategoryTotals)),
        targetCents: g.target_amount_cents,
      }));

    tabContent = (
      <>
        <Section titleKey="analytics.yearOverYear.heading">
          <YearOverYearChart data={yoyPoints} />
        </Section>

        <Section titleKey="analytics.goalProgress.heading" vars={{ period: windowLabel }}>
          <GoalProgressChart points={goalPoints} series={goalSeries} manualGoals={manualGoals} />
        </Section>
      </>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          <T k="nav.items.analytics" />
        </h1>
        {showPeriodSelector && <PeriodSelector current={period} basePath="/analytics" presets={["6m", "1a", "tout"]} />}
      </div>

      <AnalyticsTabs current={tab} periodParam={periodParam} />

      {tabContent}
    </section>
  );
}
