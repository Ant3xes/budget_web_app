import { createServerSupabaseClient } from "@/lib/supabase/server";
import { T } from "@/components/i18n/t";
import { PeriodSelector } from "@/components/period-selector";
import { AccountSelector } from "@/components/dashboard/account-selector";
import { BankBubbles } from "@/components/dashboard/bank-bubbles";
import { ConsolidatedBalanceTile } from "@/components/dashboard/consolidated-balance-tile";
import { ExpenseByCategoryWidget } from "@/components/dashboard/expense-by-category-widget";
import { ExpenseIncomeLine } from "@/components/dashboard/expense-income-line";
import { IncomeVsExpenseWidget } from "@/components/dashboard/income-vs-expense-widget";
import { BudgetStackedChart } from "@/components/dashboard/budget-stacked-chart";
import { FixedChargesSummary } from "@/components/dashboard/fixed-charges-summary";
import { SavingsGoalsSummary } from "@/components/dashboard/savings-goals-summary";
import { RecentTransactions } from "@/components/dashboard/recent-transactions";
import { RemainingToLive } from "@/components/dashboard/remaining-to-live";
import { SavingsThisMonth } from "@/components/dashboard/savings-this-month";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { computeExpenseByCategory } from "@/lib/accounts/compute-expense-by-category";
import { groupAccountBalancesByBank, type AccountBalance } from "@/lib/accounts/group-account-balances";
import { runScopedQuery } from "@/lib/accounts/run-scoped-query";
import { resolveGoalCurrentCents } from "@/lib/savings-goals/resolve-current-amount";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";
import {
  currentMonth,
  parsePeriodParam,
  periodBounds,
  floorMonthWindow,
  todayISO,
} from "@/lib/dates/period";
import { resolveEarliestTransactionDate } from "@/lib/dates/resolve-earliest-transaction-date";

/** A transaction row shaped for the click-to-open overlays (donut + budget chart). */
interface OverlayCandidate {
  id: string;
  date: string;
  description: string | null;
  category_id: string | null;
  amount_cents: number;
}

/** Groups `id/date/description/amount_cents` rows by `category_id`, dropping rows with no category — feeds both overlay widgets below. */
function groupByCategoryId(rows: OverlayCandidate[]): Record<string, { id: string; date: string; description: string | null; amount_cents: number }[]> {
  return rows.reduce<Record<string, { id: string; date: string; description: string | null; amount_cents: number }[]>>((acc, row) => {
    if (!row.category_id) return acc;
    (acc[row.category_id] ??= []).push({ id: row.id, date: row.date, description: row.description, amount_cents: row.amount_cents });
    return acc;
  }, {});
}

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
  searchParams: Promise<{ period?: string; accounts?: string }>;
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

  // Courant accounts + the account selector — every "activity" stat below
  // (KPIs, category donut, trend, budget consumption, recent transactions,
  // "Reste à vivre") is scoped to courant accounts and, within those, to
  // whatever subset is selected via `?accounts=`. Everything that
  // represents a total-net-worth snapshot rather than a period's activity
  // (solde consolidé, bulles banques, épargne ce mois, objectifs d'épargne)
  // intentionally keeps using the unfiltered `accountIds` above.
  //
  // CAUTION when adding a new query/widget below: `accountIds` and
  // `selectedCourantIds` are both plain `string[]`, so picking the wrong one
  // type-checks fine and fails silently (the widget just never reacts to the
  // account selector) — copy whichever of the two an existing "activity" vs
  // "snapshot" query above already uses, don't default to `accountIds`.
  const courantAccounts = (accountsRes.data ?? [])
    .filter((a) => a.type === "courant")
    .map((a) => ({ id: a.id, name: a.name }));
  const courantAccountIds = courantAccounts.map((a) => a.id);
  // Non-courant accounts (épargne/livret/PEL/autre) — derived here (not
  // later from `accountBalances`, which needs a separate later query) so
  // query #2 below can scope to exactly the accounts its only consumer
  // ("Épargne ce mois") needs, instead of fetching every account's month.
  const nonCourantAccountIds = (accountsRes.data ?? []).filter((a) => a.type !== "courant").map((a) => a.id);

  // Global period filter — scopes the KPI row, the category donut, the
  // income/expense trend, and "Dernières transactions". Defaults to "ce
  // mois". The "tout" preset needs the earliest transaction date to bound
  // its range (without it, periodBounds would collapse "tout" to a single
  // day) — only fetched when actually selected, to avoid an extra query on
  // every other render.
  const { period: periodParam, accounts: accountsParam } = await searchParams;
  // No `?accounts=` at all means "every courant account" (the selector's own
  // default/reset state) — checked against `undefined` specifically, not
  // falsiness: `?accounts=` (empty string) is how the selector represents
  // "every account deselected", a real, distinct state from "no filter" (see
  // build-dashboard-href.ts). A present-but-filtered list keeps only the ids
  // that are actually valid courant accounts, so a stale/tampered URL can
  // only ever narrow the selection, never smuggle in a non-courant account.
  const requestedAccountIdSet =
    accountsParam !== undefined ? new Set(accountsParam.split(",").filter(Boolean)) : null;
  const selectedCourantIds = requestedAccountIdSet
    ? courantAccountIds.filter((id) => requestedAccountIdSet.has(id))
    : courantAccountIds;
  // Set form for the O(1) membership checks below — reused by every
  // courant-scoped in-memory filter, same idiom this file already uses for
  // `nonCourantAccountIds` further down.
  const selectedCourantIdSet = new Set(selectedCourantIds);
  const period = parsePeriodParam(periodParam, now);
  const earliestDate =
    period.type === "preset" && period.value === "tout"
      ? await resolveEarliestTransactionDate(supabase, selectedCourantIds)
      : null;
  const {
    from: periodFrom,
    to: periodTo,
    monthCount: periodMonthCount,
  } = periodBounds(period, { now, earliestDate });
  // The trend chart's month buckets must end where the *selected* window
  // ends, not always "now" — true for every period type except the "range"
  // one (a past custom range, e.g. mars–mai while today is septembre, must
  // bucket into mars/avril/mai, not juillet/août/septembre).
  const periodToMonth = periodTo.slice(0, 7);
  // The current real month ("YYYY-MM"), passed down alongside `period` to
  // every client widget that needs a human period label — computed once
  // here rather than separately via `new Date()` client-side, to avoid a
  // client/server clock mismatch. Widgets resolve the actual localized text
  // themselves via `formatPeriodLabel()`/`formatCategoryWidgetLabel()`
  // (lib/i18n/format-period-label.ts) since this Server Component has no
  // access to the client-only `locale` (see LocaleProvider).
  const currentMonthValue = currentMonth(now);

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
  const [periodTxRes, monthTxRes, recentTxRes, trendTxRes, budgetsRes, goalsRes, fixedChargesRes, paidFixedChargesRes] = await Promise.all([
    // 1. Selected-period transactions for donut + KPIs. `id`/`date`/
    // `description` (beyond kind/amount/category) feed the donut's
    // click-to-open overlay (see groupByCategoryId below) — previously a
    // click here navigated to /expenses instead.
    runScopedQuery<{
      id: string;
      date: string;
      description: string | null;
      kind: string;
      amount_cents: number;
      category_id: string | null;
      categories: unknown;
    }>([selectedCourantIds], () =>
      supabase
        .from("transactions")
        .select("id, date, description, kind, amount_cents, category_id, categories(name, color, icon, is_default, translation_key)")
        .in("account_id", selectedCourantIds)
        .in("kind", ["expense", "income"])
        .gte("date", periodFrom)
        .lte("date", periodTo)
        .is("deleted_at", null),
    ),

    // 2. Non-courant accounts' transactions for the real current month —
    // feeds "Épargne ce mois" only (a snapshot independent of the period
    // filter, see comment above); scoped to `nonCourantAccountIds` (not
    // every account) since that's the only account set this query's sole
    // remaining consumer needs. "Dernières transactions" has its own
    // period-scoped query (#3) instead of being derived from this one.
    runScopedQuery<{ amount_cents: number }>([nonCourantAccountIds], () =>
      supabase
        .from("transactions")
        .select("amount_cents")
        .in("account_id", nonCourantAccountIds)
        .is("deleted_at", null)
        .gte("date", monthStart)
        .lt("date", nextMonthStart),
    ),

    // 3. "Dernières transactions" — courant-scoped, every kind, bounded by
    // the *selected period* (previously hardcoded to the current month
    // regardless of the PeriodSelector — see recent-transactions.tsx).
    // Capped at 200 rows (already ordered most-recent-first): the "tout"
    // period has no other bound, and this widget only ever shows a
    // paginated recency feed, never a full-history sum — unlike query #1,
    // whose totals must stay exhaustive.
    runScopedQuery<{
      id: string;
      account_id: string;
      amount_cents: number;
      date: string;
      description: string | null;
      kind: string;
      categories: unknown;
    }>([selectedCourantIds], () =>
      supabase
        .from("transactions")
        .select("id, account_id, amount_cents, date, description, kind, categories(name, is_default, translation_key)")
        .in("account_id", selectedCourantIds)
        .is("deleted_at", null)
        .gte("date", periodFrom)
        .lte("date", periodTo)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(200),
    ),

    // 4. Income/expense trend chart (at least 6 months — see trendFrom).
    // Bounded above by periodTo too — open-ended used to be harmless when
    // every period type ran through today, but a past "range" period must
    // not pull in transactions after its own end.
    runScopedQuery<{ kind: string; amount_cents: number; date: string }>([selectedCourantIds], () =>
      supabase
        .from("transactions")
        .select("kind, amount_cents, date")
        .in("account_id", selectedCourantIds)
        .in("kind", ["expense", "income"])
        .gte("date", trendFrom)
        .lte("date", periodTo)
        .is("deleted_at", null),
    ),

    // 5. Budgets for the real current month (with consumption) — always
    // "ce mois", independent of the period filter (see comment above).
    supabase
      .from("budgets")
      .select("id, category_id, amount_cents, categories(name, color, icon, is_default, translation_key)")
      .eq("month", monthStart)
      .is("deleted_at", null),

    // 6. Savings goals summary
    supabase
      .from("savings_goals")
      .select("id, name, target_amount_cents, current_amount_cents, color, icon, linked_category_id")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),

    // 7. Upcoming active fixed charges (today through the current month's
    // last day) — feeds both "Reste à vivre"'s secondary/parenthetical
    // figure and the new "Charges fixes" widget's list.
    supabase
      .from("fixed_charges")
      .select("id, name, amount_cents, next_due_date, categories(icon)")
      .eq("status", "active")
      .gte("next_due_date", todayStr)
      .lte("next_due_date", currentMonthEnd)
      .is("deleted_at", null)
      .order("next_due_date", { ascending: true }),

    // 8. Active fixed charges already marked paid this month (issue #35's
    // "Charges fixes" widget also lists these, not just upcoming ones) —
    // `last_paid_date` is only ever set by POST /api/fixed-charges/:id/pay.
    supabase
      .from("fixed_charges")
      .select("id, name, amount_cents, last_paid_date, categories(icon)")
      .eq("status", "active")
      .gte("last_paid_date", monthStart)
      .lte("last_paid_date", todayStr)
      .is("deleted_at", null)
      .order("last_paid_date", { ascending: false }),
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

    // `id`/`date`/`description` (beyond category_id/amount) feed the budget
    // chart's click-to-open overlay — same idea as query #1 above.
    runScopedQuery<{ id: string; date: string; description: string | null; category_id: string | null; amount_cents: number }>(
      [selectedCourantIds, budgetCatIds],
      () =>
        supabase
          .from("transactions")
          .select("id, date, description, category_id, amount_cents")
          .eq("kind", "expense")
          .in("account_id", selectedCourantIds)
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

  // ── "Reste à vivre" (courant accounts only, further scoped to whichever
  // ones are selected via the account selector) ────────────────────────────
  const courantBalanceCents = accountBalances
    .filter((a) => selectedCourantIdSet.has(a.id))
    .reduce((sum, a) => sum + a.balanceCents, 0);
  const upcomingFixedCharges = fixedChargesRes.data ?? [];
  const upcomingFixedChargesCents = upcomingFixedCharges.reduce((sum, fc) => sum + fc.amount_cents, 0);
  // Upcoming charges aren't account-scoped, so when every account has been
  // deselected they'd otherwise subtract from a balance that's 0 for an
  // unrelated reason ("no accounts chosen") — reading as "you're overdrawn"
  // rather than "nothing selected". Zero it out too in that one case.
  const remainingToLiveAfterChargesCents =
    selectedCourantIds.length === 0 ? 0 : courantBalanceCents - upcomingFixedChargesCents;

  const paidFixedCharges = paidFixedChargesRes.data ?? [];
  // Merged list for the "Charges fixes" widget: upcoming rows first (already
  // sorted ascending by the query), paid ones after (already sorted most
  // recently paid first) — `date` is next_due_date for one, last_paid_date
  // for the other, both under one field since the widget renders them the
  // same way (see FixedChargesSummary's own sort/pagination).
  const fixedChargeRows = [
    ...upcomingFixedCharges.map((fc) => ({
      id: fc.id,
      name: fc.name,
      amount_cents: fc.amount_cents,
      date: fc.next_due_date,
      icon: (fc.categories as unknown as { icon: string | null } | null)?.icon ?? null,
      paid: false as const,
    })),
    ...paidFixedCharges.map((fc) => ({
      id: fc.id,
      name: fc.name,
      amount_cents: fc.amount_cents,
      date: fc.last_paid_date as string,
      icon: (fc.categories as unknown as { icon: string | null } | null)?.icon ?? null,
      paid: true as const,
    })),
  ];

  // ── "Épargne ce mois" (non-courant accounts, any transaction kind —
  // transfers are stored as two rows so summing amount_cents already nets
  // deposits/withdrawals correctly) ────────────────────────────────────────
  // query #2 is already scoped to `nonCourantAccountIds`, so every row here
  // already qualifies — no in-memory filter needed.
  const savingsThisMonthCents = (monthTxRes.data ?? []).reduce((sum, tx) => sum + tx.amount_cents, 0);

  // ── Period KPIs ───────────────────────────────────────────────────────────
  const periodTx = periodTxRes.data ?? [];
  const periodExpense = periodTx
    .filter((t) => t.kind === "expense")
    .reduce((s, t) => s + Math.abs(t.amount_cents), 0);
  const periodIncome = periodTx
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + t.amount_cents, 0);

  // ── Donut chart data + its click-to-open overlay's source data ──────────
  // Reuses the same helper as /accounts/[id] (account-detail.tsx) instead of
  // a second inline reduce — already tested, and its (value desc, name asc)
  // tie-break is a small improvement over the previous value-only sort.
  const periodExpenseTx = periodTx.filter((t) => t.kind === "expense");
  type CategoryJoin = { name: string; color: string | null; icon: string | null; is_default: boolean; translation_key: string | null };
  const donutData = computeExpenseByCategory(
    periodExpenseTx.map((tx) => {
      const catObj = tx.categories as unknown as CategoryJoin | null;
      return {
        amount_cents: tx.amount_cents,
        categoryName: catObj?.name ?? null,
        categoryColor: catObj?.color ?? null,
        categoryIcon: catObj?.icon ?? null,
        categoryId: tx.category_id,
      };
    }),
  );
  // `computeExpenseByCategory` (shared/tested, also used by /accounts/[id])
  // groups by raw name and has no notion of is_default/translation_key —
  // attach them after the fact via categoryId, so ExpenseByCategoryWidget
  // can resolve each slice's translated display name (resolveCategoryName)
  // without touching that shared aggregation helper.
  const categoryMetaById = new Map(
    periodExpenseTx
      .filter((tx) => tx.category_id)
      .map((tx) => [tx.category_id as string, tx.categories as unknown as CategoryJoin | null]),
  );
  const donutDataWithMeta = donutData.map((point) => {
    const meta = point.categoryId ? categoryMetaById.get(point.categoryId) : null;
    return { ...point, is_default: meta?.is_default ?? false, translation_key: meta?.translation_key ?? null };
  });
  const donutTransactionsByCategory = groupByCategoryId(periodExpenseTx);
  // `groupByCategoryId` drops rows with no category_id — the donut's "Sans
  // catégorie" slice (now clickable, issue #35) needs its own bucket, keyed
  // by the same sentinel donut-chart.tsx reports on click. Kept local to the
  // donut rather than changing groupByCategoryId itself, which
  // budgetTransactionsByCategory below also relies on unchanged.
  const uncategorizedExpenseTx = periodExpenseTx
    .filter((tx) => !tx.category_id)
    .map((tx) => ({ id: tx.id, date: tx.date, description: tx.description, amount_cents: tx.amount_cents }));
  if (uncategorizedExpenseTx.length > 0) {
    donutTransactionsByCategory[UNCATEGORIZED_CATEGORY_ID] = uncategorizedExpenseTx;
  }

  // ── Income/expense trend chart (same period) ─────────────────────────────
  const barData = computeIncomeExpenseSeries(trendTxRes.data ?? [], trendMonthCount, now, periodToMonth);

  // ── Budget utilization + its click-to-open overlay's source data ────────
  const budgetConsumptionTx = budgetConsumptionRes.data ?? [];
  const budgetConsumption = sumAbsByCategoryId(budgetConsumptionTx);
  const budgetTransactionsByCategory = groupByCategoryId(budgetConsumptionTx);

  const budgetRows = budgets
    .map((b) => {
      const category = b.categories as unknown as CategoryJoin | null;
      return {
        id: b.id,
        categoryId: b.category_id,
        // `null` (not a hardcoded "Sans catégorie") when uncategorized —
        // BudgetStackedChart (client) supplies the translated fallback via
        // `t()`, same reasoning as the category name resolution below.
        categoryName: category?.name ?? null,
        categoryIcon: category?.icon ?? null,
        categoryColor: category?.color ?? null,
        isDefault: category?.is_default ?? false,
        translationKey: category?.translation_key ?? null,
        amount: b.amount_cents,
        consumed: budgetConsumption[b.category_id] ?? 0,
      };
    })
    // Highest budget max first.
    .sort((a, b) => b.amount - a.amount);

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

  // "Dernières transactions" — courant-scoped, period-scoped (query #3
  // above already applies both filters at the DB level).
  const recentTransactions = (recentTxRes.data ?? []).map((tx) => ({
    id: tx.id,
    amount_cents: tx.amount_cents,
    date: tx.date,
    description: tx.description,
    kind: tx.kind,
    categories: tx.categories as unknown as { name: string; is_default: boolean; translation_key: string | null } | null,
  }));

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">
          <T k="dashboard.title" />
        </h1>
        <PeriodSelector current={period} basePath="/dashboard" accountsParam={accountsParam} />
      </div>

      {/* Zone comptes — solde consolidé, bulles banques (elles-mêmes déjà
          dans leur propre "grosse bulle", voir bank-bubbles.tsx) et
          sélecteur de compte regroupés dans un seul panneau visuellement
          distinct du reste du dashboard (grids de DashboardCard plus bas),
          pour que cette zone de "vue d'ensemble des comptes" se distingue
          d'un premier coup d'œil des widgets d'activité/période. */}
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <T k="dashboard.accountsOverview.heading" />
        </h2>

        {/* Solde consolidé + bulles banques (remplace l'ancien bloc "Comptes par banque") */}
        <div className="flex flex-wrap items-start gap-3">
          <ConsolidatedBalanceTile amountCents={consolidatedBalance} />
          <div className="flex min-w-0 flex-1 items-center">
            <BankBubbles groups={bankGroups} />
          </div>
        </div>

        {/* Sélecteur de comptes — sous les bulles, puisqu'il ne modifie pas leur affichage */}
        <div className="mt-3">
          <AccountSelector
            accounts={courantAccounts}
            selectedIds={selectedCourantIds}
            basePath="/dashboard"
            periodParam={periodParam}
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 [&>*]:min-w-0">
        <RemainingToLive amountCents={courantBalanceCents} afterChargesCents={remainingToLiveAfterChargesCents} />
        <ExpenseIncomeLine
          periodExpense={periodExpense}
          periodIncome={periodIncome}
          period={period}
          currentMonthValue={currentMonthValue}
        />
        <SavingsThisMonth amountCents={savingsThisMonthCents} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <ExpenseByCategoryWidget
          data={donutDataWithMeta}
          period={period}
          currentMonthValue={currentMonthValue}
          transactionsByCategory={donutTransactionsByCategory}
        />
        <IncomeVsExpenseWidget
          data={barData}
          period={period}
          currentMonthValue={currentMonthValue}
          trendIsFloored={trendIsFloored}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <BudgetStackedChart rows={budgetRows} transactionsByCategory={budgetTransactionsByCategory} />
        <FixedChargesSummary charges={fixedChargeRows} totalCents={upcomingFixedChargesCents} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
        <RecentTransactions transactions={recentTransactions} />
        <SavingsGoalsSummary goals={goalSummaries} />
      </div>
    </section>
  );
}
