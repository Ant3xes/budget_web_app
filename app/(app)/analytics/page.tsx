import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PeriodSelector } from "@/components/period-selector";
import { NetWorthChart } from "@/components/analytics/net-worth-chart";
import { CashflowChart } from "@/components/analytics/cashflow-chart";
import { ExpenseTrendChart } from "@/components/analytics/expense-trend-chart";
import { computeBalanceSeries } from "@/lib/accounts/compute-balance-series";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { runScopedQuery } from "@/lib/accounts/run-scoped-query";
import { parsePeriodParam, periodBounds, periodLabel as resolvePeriodLabel } from "@/lib/dates/period";
import { resolveEarliestTransactionDate } from "@/lib/dates/resolve-earliest-transaction-date";

/**
 * "/analytics" — deep-dive page (plan §Étape 4): patrimoine net (détail),
 * cash-flow mensuel, tendance des dépenses. Every widget here is itself "a
 * flow over a time window" (unlike /dashboard, which also has snapshot/
 * calendar-fixed widgets that stay unscoped — see period-selector.tsx), so
 * all three are scoped by the same global period filter (`PeriodSelector`),
 * exactly as selected — no artificial minimum window, so "Ce mois" genuinely
 * shows one month of data on all three charts.
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const now = new Date();

  // Active accounts — fetched first (own round-trip) because every
  // transactions query below needs accountIds to scope to them, including
  // "tout"'s own earliest-date resolution. Soft-deleting an account only
  // sets accounts.deleted_at — its transactions keep deleted_at = null
  // forever (no cascade) — so without this a deleted account's history
  // keeps skewing net worth/cash-flow/trend, and could even stretch "tout"
  // further back than the (now-scoped) charts have any data for.
  const accountsRes = await supabase.from("accounts").select("id, initial_balance_cents").is("deleted_at", null);
  const accountIds = (accountsRes.data ?? []).map((a) => a.id);

  const { period: periodParam } = await searchParams;
  // Analytics' choices start at 6 months (no "1m"/"3m" here, see
  // <PeriodSelector presets> below) — default the unset case to "6m" too,
  // instead of parsePeriodParam's own implicit "current month" default,
  // so the selector always has a matching preset highlighted.
  const period = parsePeriodParam(periodParam ?? "6m", now);
  const earliestDate =
    period.type === "preset" && period.value === "tout"
      ? await resolveEarliestTransactionDate(supabase, accountIds)
      : null;
  const { from: windowFrom, to: windowTo, monthCount: windowMonthCount } = periodBounds(period, { now, earliestDate });
  const windowLabel = resolvePeriodLabel(period, now);
  // Every widget's series must end where the *selected* window ends, not
  // always "now" — true for every period type except the new "range" one
  // (a past custom range must bucket into its own months, not today's).
  const windowToMonth = windowTo.slice(0, 7);
  // computeBalanceSeries always spans from the earliest transaction through
  // now (it has no `monthCount` window of its own — the running balance
  // must start from account inception to be correct), so the selected
  // window is applied by slicing its result rather than by bounding that
  // query; `windowFrom` only bounds the cash-flow/expense-trend query below.

  const [allTxRes, windowTxRes] = await Promise.all([
    // 1. All-time transactions (unbounded) for the net-worth running total —
    // must start from account inception, sliced to the window afterward.
    runScopedQuery<{ amount_cents: number; date: string }>([accountIds], () =>
      supabase.from("transactions").select("amount_cents, date").in("account_id", accountIds).is("deleted_at", null),
    ),

    // 2. Window-bounded transactions for cash-flow + expense-trend. Bounded
    // above by windowTo too — open-ended used to be harmless when every
    // period type ran through today, but a past "range" period must not
    // pull in transactions after its own end.
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
  ]);

  const initialBalanceTotal = (accountsRes.data ?? []).reduce((sum, a) => sum + a.initial_balance_cents, 0);
  const fullNetWorthSeries = computeBalanceSeries(allTxRes.data ?? [], initialBalanceTotal, now, windowToMonth);
  const netWorthSeries = windowMonthCount === null ? fullNetWorthSeries : fullNetWorthSeries.slice(-windowMonthCount);

  const windowSeries = computeIncomeExpenseSeries(windowTxRes.data ?? [], windowMonthCount, now, windowToMonth);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <PeriodSelector current={period} basePath="/analytics" presets={["6m", "1a", "tout"]} />
      </div>

      <DashboardCard>
        <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Patrimoine net ({windowLabel})
        </h2>
        <NetWorthChart data={netWorthSeries} />
      </DashboardCard>

      <DashboardCard>
        <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Cash-flow mensuel ({windowLabel})
        </h2>
        <CashflowChart data={windowSeries} />
      </DashboardCard>

      <DashboardCard>
        <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Tendance des dépenses ({windowLabel})
        </h2>
        <ExpenseTrendChart data={windowSeries} />
      </DashboardCard>
    </section>
  );
}
