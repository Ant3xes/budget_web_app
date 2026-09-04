import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AlertBanners } from "@/components/dashboard/alert-banners";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { PeriodSelector } from "@/components/dashboard/period-selector";
import { AccountBalances } from "@/components/dashboard/account-balances";
import { ExpenseByCategoryWidget } from "@/components/dashboard/expense-by-category-widget";
import { IncomeVsExpenseWidget } from "@/components/dashboard/income-vs-expense-widget";
import { BudgetUtilization } from "@/components/dashboard/budget-utilization";
import { SavingsGoalsSummary } from "@/components/dashboard/savings-goals-summary";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { computeExpenseByCategory } from "@/lib/accounts/compute-expense-by-category";
import { groupAccountBalancesByBank, type AccountBalance } from "@/lib/accounts/group-account-balances";
import { resolveGoalCurrentCents } from "@/lib/savings-goals/resolve-current-amount";
import { parsePeriodParam, periodBounds, currentMonth, addMonths, toMonthLabel, PERIOD_PRESET_LABELS } from "@/lib/dates/period";

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

  // Global period filter (plan §Étape 3) — scopes the KPI row, the category
  // donut, and the income/expense trend. Defaults to "ce mois". The "tout"
  // preset needs the earliest transaction date to bound its range (without
  // it, periodBounds would collapse "tout" to a single day) — only fetched
  // when actually selected, to avoid an extra query on every other render.
  const { period: periodParam } = await searchParams;
  const period = parsePeriodParam(periodParam, now);
  let earliestDate: string | null = null;
  if (period.type === "preset" && period.value === "tout") {
    const { data } = await supabase
      .from("transactions")
      .select("date")
      .is("deleted_at", null)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();
    earliestDate = data?.date ?? null;
  }
  const {
    from: periodFrom,
    to: periodTo,
    monthCount: periodMonthCount,
  } = periodBounds(period, { now, earliestDate });
  // `parsePeriodParam` also accepts an arbitrary `?period=YYYY-MM` (not just
  // the 5 presets `PeriodSelector` links to) — label that case properly
  // instead of always falling back to "ce mois".
  const periodLabel =
    period.type === "preset"
      ? PERIOD_PRESET_LABELS[period.value].toLowerCase()
      : period.month === currentMonth(now)
        ? "ce mois"
        : toMonthLabel(period.month);

  // The trend chart always shows at least 6 months (a 1-bar chart when the
  // filter is "ce mois" would defeat the point of a trend view) — the
  // period filter can only widen this baseline (e.g. "1 an"/"tout"), never
  // shrink it. Reuses periodBounds's own `monthCount` (same convention as
  // /accounts/[id]'s account-detail.tsx) instead of re-deriving a month
  // span by hand from date strings.
  const trendMonthCount = periodMonthCount === null ? null : Math.max(6, periodMonthCount);
  const trendIsFloored = trendMonthCount !== null && trendMonthCount !== periodMonthCount;
  const trendFrom = trendIsFloored ? `${addMonths(currentMonth(now), -5)}-01` : periodFrom;
  const trendLabel = trendIsFloored ? "6 mois" : periodLabel;

  const [accountsRes, periodTxRes, last10Res, trendTxRes, budgetsRes, fixedChargesAlertRes, goalsRes] =
    await Promise.all([
      // 1. Accounts with their transactions for correct balance calculation
      supabase
        .from("accounts")
        .select("id, name, type, bank, initial_balance_cents")
        .is("deleted_at", null),

      // 2. Selected-period transactions for donut + KPIs (category_id is
      // also used for the drill-down link into /expenses)
      supabase
        .from("transactions")
        .select("kind, amount_cents, category_id, categories(name, color)")
        .in("kind", ["expense", "income"])
        .gte("date", periodFrom)
        .lte("date", periodTo)
        .is("deleted_at", null),

      // 3. Last 10 transactions
      supabase
        .from("transactions")
        .select("id, amount_cents, date, description, kind, categories(name)")
        .is("deleted_at", null)
        .not("kind", "in", '("transfer_debit","transfer_credit")')
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10),

      // 4. Income/expense trend chart (at least 6 months — see trendFrom)
      supabase
        .from("transactions")
        .select("kind, amount_cents, date")
        .in("kind", ["expense", "income"])
        .gte("date", trendFrom)
        .is("deleted_at", null),

      // 5. Budgets for the real current month (with consumption) — always
      // "ce mois", independent of the period filter (see comment above).
      supabase
        .from("budgets")
        .select("id, category_id, amount_cents, categories(name, color, icon)")
        .eq("month", monthStart)
        .is("deleted_at", null),

      // 6. Upcoming fixed charges (active, due in ≤ 7 days)
      supabase
        .from("fixed_charges")
        .select("id, name, next_due_date, amount_cents")
        .eq("status", "active")
        .lte("next_due_date", new Date(now.getTime() + 7 * 86400 * 1000).toISOString().slice(0, 10))
        .is("deleted_at", null)
        .order("next_due_date", { ascending: true }),

      // 7. Savings goals summary
      supabase
        .from("savings_goals")
        .select("id, name, target_amount_cents, current_amount_cents, color, icon, linked_category_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
    ]);

  // ── Per-account / per-category running totals ────────────────────────────
  // These 3 queries are each derived from the main batch's results but don't
  // depend on one another — fired together instead of one `await` after
  // another (3 sequential round-trips → 1).
  const accountIds = (accountsRes.data ?? []).map((a) => a.id);
  const budgets = budgetsRes.data ?? [];
  const budgetCatIds = budgets.map((b) => b.category_id).filter(Boolean);
  const goals = goalsRes.data ?? [];
  const linkedCategoryIds = goals.map((g) => g.linked_category_id).filter((id): id is string => Boolean(id));

  const [accountTxRes, budgetConsumptionRes, goalTxRes] = await Promise.all([
    accountIds.length > 0
      ? supabase
          .from("transactions")
          .select("account_id, amount_cents")
          .in("account_id", accountIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: null as { account_id: string; amount_cents: number }[] | null }),

    budgetCatIds.length > 0
      ? supabase
          .from("transactions")
          .select("category_id, amount_cents")
          .eq("kind", "expense")
          .in("category_id", budgetCatIds)
          .gte("date", monthStart)
          .lt("date", nextMonthStart)
          .is("deleted_at", null)
      : Promise.resolve({ data: null as { category_id: string | null; amount_cents: number }[] | null }),

    linkedCategoryIds.length > 0
      ? supabase
          .from("transactions")
          .select("category_id, amount_cents")
          .in("category_id", linkedCategoryIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: null as { category_id: string | null; amount_cents: number }[] | null }),
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
        const catObj = tx.categories as unknown as { name: string; color: string | null } | null;
        return {
          amount_cents: tx.amount_cents,
          categoryName: catObj?.name ?? null,
          categoryColor: catObj?.color ?? null,
          categoryId: tx.category_id,
        };
      }),
  );

  // ── Income/expense trend chart (same period) ─────────────────────────────
  const barData = computeIncomeExpenseSeries(trendTxRes.data ?? [], trendMonthCount, now);

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

  // ── Alerts ───────────────────────────────────────────────────────────────
  const upcomingCharges = fixedChargesAlertRes.data ?? [];
  const exceededBudgets = budgetRows.filter((b) => b.consumed > b.amount);

  const recentTransactions = (last10Res.data ?? []).map((tx) => ({
    id: tx.id,
    amount_cents: tx.amount_cents,
    description: tx.description,
    categories: tx.categories as unknown as { name: string } | null,
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <PeriodSelector current={period} />
      </div>

      <AlertBanners upcomingCharges={upcomingCharges} exceededBudgets={exceededBudgets} />

      <KpiRow
        consolidatedBalance={consolidatedBalance}
        periodExpense={periodExpense}
        periodIncome={periodIncome}
        periodLabel={periodLabel}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <ExpenseByCategoryWidget data={donutData} periodLabel={periodLabel} />
        <IncomeVsExpenseWidget data={barData} periodLabel={trendLabel} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AccountBalances groups={bankGroups} />
        <SavingsGoalsSummary goals={goalSummaries} />
      </div>

      <BudgetUtilization rows={budgetRows} />

      <RecentTransactions transactions={recentTransactions} />
    </section>
  );
}
