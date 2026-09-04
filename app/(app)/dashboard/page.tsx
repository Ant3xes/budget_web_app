import { createServerSupabaseClient } from "@/lib/supabase/server";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { PeriodSelector } from "@/components/period-selector";
import { AccountBalances } from "@/components/dashboard/account-balances";
import { ExpenseByCategoryWidget } from "@/components/dashboard/expense-by-category-widget";
import { IncomeVsExpenseWidget } from "@/components/dashboard/income-vs-expense-widget";
import { BudgetStackedChart } from "@/components/dashboard/budget-stacked-chart";
import { SavingsGoalsSummary } from "@/components/dashboard/savings-goals-summary";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { RemainingToLive } from "@/components/dashboard/remaining-to-live";
import { SavingsThisMonth } from "@/components/dashboard/savings-this-month";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { computeExpenseByCategory } from "@/lib/accounts/compute-expense-by-category";
import { groupAccountBalancesByBank, type AccountBalance } from "@/lib/accounts/group-account-balances";
import { runScopedQuery } from "@/lib/accounts/run-scoped-query";
import { resolveGoalCurrentCents } from "@/lib/savings-goals/resolve-current-amount";
import {
  parsePeriodParam,
  periodBounds,
  floorMonthWindow,
  periodLabel as resolvePeriodLabel,
  todayISO,
  toMonthLabel,
} from "@/lib/dates/period";
import { resolveEarliestTransactionDate } from "@/lib/dates/resolve-earliest-transaction-date";

/** Sums `amount_cents` by `category_id`, dropping rows with no category — used for both budget consumption and linked-goal totals below. */
function sumAbsByCategoryId(rows: { category_id: string | null; amount_cents: number }[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    if (row.category_id) acc[row.category_id] = (acc[row.category_id] ?? 0) + Math.abs(row.amount_cents);
    return acc;
  }, {});
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const supabase = await createServerSupabaseClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonthNum = now.getMonth() + 1; // 1-based
  // Budgets are inherently calendar-month envelopes (not rangeable), and
  // "solde consolidé" is a snapshot — both stay tied to the real current
  // month regardless of the period filter below (see period-selector.tsx).
  const monthStart = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}-01`;
  const nextMonthStart =
    currentMonthNum === 12
      ? `${currentYear + 1}-01-01`
      : `${currentYear}-${String(currentMonthNum + 1).padStart(2, "0")}-01`;
  // Current month's last day (mirrors periodBounds()'s own month-end calc)
  // — bounds "Reste à vivre"'s upcoming-fixed-charges query below.
  const currentMonthLastDay = new Date(Date.UTC(currentYear, currentMonthNum, 0)).getUTCDate();
  const currentMonthEnd = `${currentYear}-${String(currentMonthNum).padStart(2, "0")}-${String(currentMonthLastDay).padStart(2, "0")}`;
  const todayStr = todayISO(now);

  // Active accounts — fetched first (own round-trip, a deliberate one-request
  // trade-off for correctness) because every transactions query on this page
  // needs accountIds to scope to them, including "tout"'s own earliest-date
  // resolution below. Soft-deleting an account only sets accounts.deleted_at
  // (no cascade to transactions.deleted_at), so without this every dashboard
  // figure — KPIs, donut, trend, recent transactions, budget/goal
  // consumption, upcoming fixed charges, and even "tout"'s start date — keeps
  // silently including a deleted account's history forever. Decided
  // explicitly: deleting an account removes it from every dashboard figure,
  // not just the balance (accountTxRes further below).
  const accountsRes = await supabase
    .from("accounts")
    .select("id, name, type, bank, initial_balance_cents")
    .is("deleted_at", null);
  const accountIds = (accountsRes.data ?? []).map((a) => a.id);

  // Global period filter (plan §Étape 3) — scopes the KPI row, the category
  // donut, and the income/expense trend. Defaults to "ce mois". The "tout"
  // preset needs the earliest transaction date to bound its range (without
  // it, periodBounds would collapse "tout" to a single day) — only fetched
  // when actually selected, to avoid an extra query on every other render.
  const { period: periodParam } = await searchParams;
  const period = parsePeriodParam(periodParam, now);
  const earliestDate =
    period.type === "preset" && period.value === "tout"
      ? await resolveEarliestTransactionDate(supabase, accountIds)
      : null;
  const {
    from: periodFrom,
    to: periodTo,
    monthCount: periodMonthCount,
  } = periodBounds(period, { now, earliestDate });
  // The trend chart's month buckets must end where the *selected* window
  // ends, not always "now" — true for every period type except the new
  // "range" one (a past custom range, e.g. mars–mai while today is
  // septembre, must bucket into mars/avril/mai, not juillet/août/septembre).
  const periodToMonth = periodTo.slice(0, 7);
  // `parsePeriodParam` also accepts an arbitrary `?period=YYYY-MM` (not just
  // the 5 presets `PeriodSelector` links to) — label that case properly
  // instead of always falling back to "ce mois".
  const periodLabel = resolvePeriodLabel(period, now);
  // "Dépensé par catégorie" gets its own dedicated label: an explicit month
  // name (e.g. "septembre 2026") instead of the shared periodLabel's "ce
  // mois" wording for the current-month case — the shared helper stays
  // untouched since it's also used by the KPI row and /analytics.
  const categoryWidgetLabel = period.type === "month" ? toMonthLabel(period.month) : periodLabel;

  // The trend chart always shows at least 6 months (a 1-bar chart when the
  // filter is "ce mois" would defeat the point of a trend view) — the
  // period filter can only widen this baseline (e.g. "1 an"/"tout"), never
  // shrink it. Same helper /analytics uses for all 3 of its widgets.
  const { from: trendFrom, monthCount: trendMonthCount, isFloored: trendIsFloored } = floorMonthWindow(
    periodFrom,
    periodMonthCount,
    6,
    now,
    periodToMonth,
  );
  const trendLabel = trendIsFloored ? "6 mois" : periodLabel;

  const [periodTxRes, monthTxRes, trendTxRes, budgetsRes, goalsRes, fixedChargesRes] = await Promise.all([
    // 1. Selected-period transactions for donut + KPIs (category_id is
    // also used for the drill-down link into /expenses)
    runScopedQuery<{ kind: string; amount_cents: number; category_id: string | null; categories: unknown }>(
      [accountIds],
      () =>
        supabase
          .from("transactions")
          .select("kind, amount_cents, category_id, categories(name, color, icon)")
          .in("account_id", accountIds)
          .in("kind", ["expense", "income"])
          .gte("date", periodFrom)
          .lte("date", periodTo)
          .is("deleted_at", null),
    ),

    // 2. All transactions (every kind, including transfers) for the real
    // current month — "Dernières transactions" now shows the whole month,
    // paginated client-side, rather than a hard-capped top-10.
    runScopedQuery<{
      id: string;
      account_id: string;
      amount_cents: number;
      date: string;
      description: string | null;
      kind: string;
      categories: unknown;
    }>([accountIds], () =>
      supabase
        .from("transactions")
        .select("id, account_id, amount_cents, date, description, kind, categories(name)")
        .in("account_id", accountIds)
        .is("deleted_at", null)
        .gte("date", monthStart)
        .lt("date", nextMonthStart)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false }),
    ),

    // 3. Income/expense trend chart (at least 6 months — see trendFrom).
    // Bounded above by periodTo too — open-ended used to be harmless when
    // every period type ran through today, but a past "range" period must
    // not pull in transactions after its own end.
    runScopedQuery<{ kind: string; amount_cents: number; date: string }>([accountIds], () =>
      supabase
        .from("transactions")
        .select("kind, amount_cents, date")
        .in("account_id", accountIds)
        .in("kind", ["expense", "income"])
        .gte("date", trendFrom)
        .lte("date", periodTo)
        .is("deleted_at", null),
    ),

    // 4. Budgets for the real current month (with consumption) — always
    // "ce mois", independent of the period filter (see comment above).
    supabase
      .from("budgets")
      .select("id, category_id, amount_cents, categories(name, color, icon)")
      .eq("month", monthStart)
      .is("deleted_at", null),

    // 5. Savings goals summary
    supabase
      .from("savings_goals")
      .select("id, name, target_amount_cents, current_amount_cents, color, icon, linked_category_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),

    // 6. Upcoming active fixed charges (today through the current month's
    // last day) — feeds "Reste à vivre"'s secondary/parenthetical figure.
    supabase
      .from("fixed_charges")
      .select("amount_cents")
      .eq("status", "active")
      .gte("next_due_date", todayStr)
      .lte("next_due_date", currentMonthEnd)
      .is("deleted_at", null),
  ]);

  // ── Per-account / per-category running totals ────────────────────────────
  // These 3 queries are each derived from the main batch's results but don't
  // depend on one another — fired together instead of one `await` after
  // another (3 sequential round-trips → 1).
  const budgets = budgetsRes.data ?? [];
  const budgetCatIds = budgets.map((b) => b.category_id).filter(Boolean);
  const goals = goalsRes.data ?? [];
  const linkedCategoryIds = goals.map((g) => g.linked_category_id).filter((id): id is string => Boolean(id));

  const [accountTxRes, budgetConsumptionRes, goalTxRes] = await Promise.all([
    runScopedQuery<{ account_id: string; amount_cents: number }>([accountIds], () =>
      supabase
        .from("transactions")
        .select("account_id, amount_cents")
        .in("account_id", accountIds)
        .is("deleted_at", null),
    ),

    runScopedQuery<{ category_id: string | null; amount_cents: number }>([accountIds, budgetCatIds], () =>
      supabase
        .from("transactions")
        .select("category_id, amount_cents")
        .eq("kind", "expense")
        .in("account_id", accountIds)
        .in("category_id", budgetCatIds)
        .gte("date", monthStart)
        .lt("date", nextMonthStart)
        .is("deleted_at", null),
    ),

    runScopedQuery<{ category_id: string | null; amount_cents: number }>([accountIds, linkedCategoryIds], () =>
      supabase
        .from("transactions")
        .select("category_id, amount_cents")
        .in("account_id", accountIds)
        .in("category_id", linkedCategoryIds)
        .is("deleted_at", null),
    ),
  ]);

  // ── Per-account balances (correct: initial + own transactions) ───────────
  const accountTxTotals = (accountTxRes.data ?? []).reduce<Record<string, number>>((acc, tx) => {
    acc[tx.account_id] = (acc[tx.account_id] ?? 0) + tx.amount_cents;
    return acc;
  }, {});
  const accountBalances: AccountBalance[] = (accountsRes.data ?? []).map((acc) => ({
    id: acc.id,
    name: acc.name,
    type: acc.type,
    bank: acc.bank,
    balanceCents: acc.initial_balance_cents + (accountTxTotals[acc.id] ?? 0),
  }));
  const consolidatedBalance = accountBalances.reduce((sum, acc) => sum + acc.balanceCents, 0);
  const bankGroups = groupAccountBalancesByBank(accountBalances);

  // ── "Reste à vivre" (courant accounts only) ──────────────────────────────
  const courantBalanceCents = accountBalances
    .filter((a) => a.type === "courant")
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const upcomingFixedChargesCents = (fixedChargesRes.data ?? []).reduce((sum, fc) => sum + fc.amount_cents, 0);
  const remainingToLiveAfterChargesCents = courantBalanceCents - upcomingFixedChargesCents;

  // ── "Épargne ce mois" (non-courant accounts, any transaction kind —
  // transfers are stored as two rows so summing amount_cents already nets
  // deposits/withdrawals correctly) ────────────────────────────────────────
  const nonCourantAccountIds = new Set(accountBalances.filter((a) => a.type !== "courant").map((a) => a.id));
  const savingsThisMonthCents = (monthTxRes.data ?? [])
    .filter((tx) => nonCourantAccountIds.has(tx.account_id))
    .reduce((sum, tx) => sum + tx.amount_cents, 0);

  // ── Period KPIs ───────────────────────────────────────────────────────────
  const periodTx = periodTxRes.data ?? [];
  const periodExpense = periodTx
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + Math.abs(t.amount_cents), 0);
  const periodIncome = periodTx
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + t.amount_cents, 0);

  // ── Donut chart data ─────────────────────────────────────────────────────
  // Reuses the same helper as /accounts/[id] (account-detail.tsx) instead of
  // a second inline reduce — already tested, and its (value desc, name asc)
  // tie-break is a small improvement over the previous value-only sort.
  const donutData = computeExpenseByCategory(
    periodTx
      .filter((t) => t.kind === "expense")
      .map((tx) => {
        const catObj = tx.categories as unknown as { name: string; color: string | null; icon: string | null } | null;
        return {
          amount_cents: tx.amount_cents,
          categoryName: catObj?.name ?? null,
          categoryColor: catObj?.color ?? null,
          categoryIcon: catObj?.icon ?? null,
          categoryId: tx.category_id,
        };
      }),
  );

  // ── Income/expense trend chart (same period) ─────────────────────────────
  const barData = computeIncomeExpenseSeries(trendTxRes.data ?? [], trendMonthCount, now, periodToMonth);

  // ── Budget utilization ───────────────────────────────────────────────────
  const budgetConsumption = sumAbsByCategoryId(budgetConsumptionRes.data ?? []);

  const budgetRows = budgets
    .map((b) => {
      const category = b.categories as unknown as { name: string; color: string | null; icon: string | null } | null;
      return {
        id: b.id,
        categoryId: b.category_id,
        categoryName: category?.name ?? "Sans catégorie",
        categoryIcon: category?.icon ?? null,
        categoryColor: category?.color ?? null,
        amount: b.amount_cents,
        consumed: budgetConsumption[b.category_id] ?? 0,
      };
    })
    .sort((a, b) => {
      const ra = a.amount > 0 ? a.consumed / a.amount : 0;
      const rb = b.amount > 0 ? b.consumed / b.amount : 0;
      return rb - ra;
    });

  // ── Savings goals summary ────────────────────────────────────────────────
  // The category-totals fetch (Supabase query) is duplicated from
  // app/api/savings-goals/route.ts's GET handler rather than called over
  // HTTP, since this is already a Server Component — but the actual
  // resolution rule is shared via resolveGoalCurrentCents.
  const goalCategoryTotals = sumAbsByCategoryId(goalTxRes.data ?? []);
  const goalSummaries = goals.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon,
    color: g.color,
    currentCents: resolveGoalCurrentCents(g, goalCategoryTotals),
    targetCents: g.target_amount_cents,
  }));

  const recentTransactions = (monthTxRes.data ?? []).map((tx) => ({
    id: tx.id,
    amount_cents: tx.amount_cents,
    date: tx.date,
    description: tx.description,
    kind: tx.kind,
    categories: tx.categories as unknown as { name: string } | null,
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <PeriodSelector current={period} basePath="/dashboard" />
      </div>

      <KpiRow
        consolidatedBalance={consolidatedBalance}
        periodExpense={periodExpense}
        periodIncome={periodIncome}
        periodLabel={periodLabel}
      />

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <RemainingToLive amountCents={courantBalanceCents} afterChargesCents={remainingToLiveAfterChargesCents} />
        <SavingsThisMonth amountCents={savingsThisMonthCents} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <ExpenseByCategoryWidget data={donutData} periodLabel={categoryWidgetLabel} />
        <IncomeVsExpenseWidget data={barData} periodLabel={trendLabel} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <AccountBalances groups={bankGroups} />
        <SavingsGoalsSummary goals={goalSummaries} />
      </div>

      <BudgetStackedChart rows={budgetRows} />

      <RecentTransactions transactions={recentTransactions} />
    </section>
  );
}
