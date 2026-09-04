import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { PeriodSelector } from "@/components/period-selector";
import { NetWorthChart } from "@/components/analytics/net-worth-chart";
import { CashflowChart } from "@/components/analytics/cashflow-chart";
import { ExpenseTrendChart } from "@/components/analytics/expense-trend-chart";
import { computeBalanceSeries } from "@/lib/accounts/compute-balance-series";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { parsePeriodParam, periodBounds, floorMonthWindow, periodLabel as resolvePeriodLabel } from "@/lib/dates/period";
import { resolveEarliestTransactionDate } from "@/lib/dates/resolve-earliest-transaction-date";

/**
 * "/analytics" — deep-dive page (plan §Étape 4): patrimoine net (détail),
 * cash-flow mensuel, tendance des dépenses. Every widget here is itself "a
 * flow over a time window" (unlike /dashboard, which also has snapshot/
 * calendar-fixed widgets that stay unscoped — see period-selector.tsx), so
 * all three are scoped by the same global period filter, each floored to a
 * minimum 6-month window via `floorMonthWindow` (same rule as the
 * dashboard's own trend chart).
 */
export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const now = new Date();

  const { period: periodParam } = await searchParams;
  const period = parsePeriodParam(periodParam, now);
  const earliestDate =
    period.type === "preset" && period.value === "tout" ? await resolveEarliestTransactionDate(supabase) : null;
  const { from: periodFrom, monthCount: periodMonthCount } = periodBounds(period, { now, earliestDate });
  const periodLabel = resolvePeriodLabel(period, now);

  const {
    from: windowFrom,
    monthCount: windowMonthCount,
    isFloored,
  } = floorMonthWindow(periodFrom, periodMonthCount, 6, now);
  const windowLabel = isFloored ? "6 mois" : periodLabel;
  // computeBalanceSeries always spans from the earliest transaction through
  // now (it has no `monthCount` window of its own — the running balance
  // must start from account inception to be correct), so the floored window
  // is applied by slicing its result rather than by bounding that query;
  // `windowFrom` (from floorMonthWindow, same as dashboard/page.tsx's
  // trendFrom) only bounds the cash-flow/expense-trend query below.

  const accountsRes = await supabase.from("accounts").select("id, initial_balance_cents").is("deleted_at", null);
  // Soft-deleting an account only sets accounts.deleted_at — its
  // transactions keep transactions.deleted_at = null forever (no cascade),
  // so both transaction queries below must scope to active account ids
  // explicitly, same as dashboard/page.tsx's accountTxRes — otherwise a
  // deleted account's history keeps skewing net worth/cash-flow/trend after
  // its initial balance has already dropped out of initialBalanceTotal.
  const accountIds = (accountsRes.data ?? []).map((a) => a.id);

  const [allTxRes, windowTxRes] = await Promise.all([
    // 1. All-time transactions (unbounded) for the net-worth running total —
    // must start from account inception, sliced to the window afterward.
    accountIds.length > 0
      ? supabase.from("transactions").select("amount_cents, date").in("account_id", accountIds).is("deleted_at", null)
      : Promise.resolve({ data: [] as { amount_cents: number; date: string }[] }),

    // 2. Window-bounded transactions for cash-flow + expense-trend.
    accountIds.length > 0
      ? supabase
          .from("transactions")
          .select("kind, amount_cents, date")
          .in("account_id", accountIds)
          .in("kind", ["expense", "income"])
          .is("deleted_at", null)
          .gte("date", windowFrom)
      : Promise.resolve({ data: [] as { kind: string; amount_cents: number; date: string }[] }),
  ]);

  const initialBalanceTotal = (accountsRes.data ?? []).reduce((sum, a) => sum + a.initial_balance_cents, 0);
  const fullNetWorthSeries = computeBalanceSeries(allTxRes.data ?? [], initialBalanceTotal, now);
  const netWorthSeries = windowMonthCount === null ? fullNetWorthSeries : fullNetWorthSeries.slice(-windowMonthCount);

  const windowSeries = computeIncomeExpenseSeries(windowTxRes.data ?? [], windowMonthCount, now);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <PeriodSelector current={period} basePath="/analytics" />
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
