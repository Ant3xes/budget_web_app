/**
 * Adapters between the SQL aggregates of migration 20261016090000 (issue 121)
 * and the pure `compute*` series functions. The analytics page used to read
 * every transaction of the space and sum them in Node; the database now returns
 * one row per (account, month) / (category, month) and these helpers reshape
 * those rows so the existing series functions give the exact same figures.
 */

/** One row of `analytics_account_monthly_deltas`: anchor-filtered sum of an account's month. */
export type AccountMonthlyDeltaRow = { account_id: string; month: string; total_cents: number | string };

/** One row of `analytics_goal_category_monthly`: sum of |amount| of a goal-linked category's month. */
export type GoalCategoryMonthlyRow = { category_id: string; month: string; total_abs_cents: number | string };

/** One row of `analytics_account_balances`: anchor-filtered sums up to today / up to the period end. */
export type AccountBalanceRow = { account_id: string; today_cents: number | string; window_cents: number | string };

/**
 * A month's sum becomes a single pseudo-transaction dated the 1st of that
 * month: `computeBalanceSeries` only compares dates to end-of-month cutoffs
 * and takes the earliest one for its start month, so both stay identical.
 */
export function monthlyDeltasToTransactions(rows: AccountMonthlyDeltaRow[]): { date: string; amount_cents: number }[] {
  return rows.map((r) => ({ date: `${r.month}-01`, amount_cents: Number(r.total_cents) }));
}

/** Same idea for goals: `amount_cents` already holds the sum of absolute amounts. */
export function goalMonthlyToTransactions(
  rows: GoalCategoryMonthlyRow[],
): { date: string; category_id: string; amount_cents: number }[] {
  return rows.map((r) => ({ date: `${r.month}-01`, category_id: r.category_id, amount_cents: Number(r.total_abs_cents) }));
}

/** Per-account sums keyed by account id; an account without any counted transaction is simply absent (= 0). */
export function accountBalanceTotals(rows: AccountBalanceRow[]): {
  todayByAccountId: Map<string, number>;
  windowByAccountId: Map<string, number>;
} {
  const todayByAccountId = new Map<string, number>();
  const windowByAccountId = new Map<string, number>();
  for (const r of rows) {
    todayByAccountId.set(r.account_id, Number(r.today_cents));
    windowByAccountId.set(r.account_id, Number(r.window_cents));
  }
  return { todayByAccountId, windowByAccountId };
}
