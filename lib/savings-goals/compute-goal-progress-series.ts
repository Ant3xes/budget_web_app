const MONTH_ABBR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export type GoalProgressTx = { date: string; category_id: string | null; amount_cents: number };
export type GoalProgressGoal = { id: string; name: string; linked_category_id: string | null; color: string | null };
export type GoalProgressSeriesPoint = { month: string; [goalId: string]: number | string };

function toYearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function addMonth(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y!, m! - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(yyyyMM: string): string {
  const mon = parseInt(yyyyMM.slice(5, 7), 10);
  const yy = yyyyMM.slice(2, 4);
  return `${MONTH_ABBR[mon - 1] ?? yyyyMM} ${yy}`;
}

/**
 * Cumulative monthly progress per savings goal, for goals linked to a
 * category (issue #36 "Progression des objectifs d'épargne dans le
 * temps") — same running-total idea as `computeBalanceSeries`, scoped per
 * goal's linked category instead of per account, starting from 0 instead
 * of an initial balance. A goal with no `linked_category_id` (a manual
 * goal, tracked by hand via `current_amount_cents`) has no transaction
 * history to derive a series from — excluded from `series`/`points`
 * entirely; the caller shows its current value as a plain figure instead
 * (see components/analytics/goal-progress-chart.tsx).
 *
 * `transactions` should be every transaction (any date, unbounded) in any
 * of the linked categories — like net worth, "progress so far" needs the
 * full history, not just the visible window; this only trims the *display*
 * window to the trailing months through `endMonth`.
 */
export function computeGoalProgressSeries(
  transactions: GoalProgressTx[],
  goals: GoalProgressGoal[],
  monthCount: number | null = 6,
  now: Date = new Date(),
  endMonth?: string,
): { points: GoalProgressSeriesPoint[]; series: { key: string; name: string; color: string | null }[] } {
  const linkedGoals = goals.filter((g) => g.linked_category_id !== null);
  const series = linkedGoals.map((g) => ({ key: g.id, name: g.name, color: g.color }));
  if (linkedGoals.length === 0) return { points: [], series: [] };

  const categoryToGoalIds = new Map<string, string[]>();
  for (const g of linkedGoals) {
    const list = categoryToGoalIds.get(g.linked_category_id!) ?? [];
    list.push(g.id);
    categoryToGoalIds.set(g.linked_category_id!, list);
  }

  const currentMonth = endMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  let startMonth = currentMonth;
  if (monthCount === null) {
    if (transactions.length > 0) {
      const earliest = transactions.reduce((min, tx) => (tx.date < min ? tx.date : min), transactions[0]!.date);
      startMonth = toYearMonth(earliest);
    }
  } else {
    startMonth = addMonth(currentMonth, -(monthCount - 1));
  }

  // Full month range from the earliest relevant transaction through
  // currentMonth, so the running cumulative sum is correct even when the
  // displayed window (startMonth..currentMonth) starts later.
  let cumulStart = startMonth;
  if (transactions.length > 0) {
    const earliest = transactions.reduce((min, tx) => (tx.date < min ? tx.date : min), transactions[0]!.date);
    const earliestMonth = toYearMonth(earliest);
    if (earliestMonth < cumulStart) cumulStart = earliestMonth;
  }

  const runningByGoal = new Map(linkedGoals.map((g) => [g.id, 0]));
  const points: GoalProgressSeriesPoint[] = [];
  for (let month = cumulStart; month <= currentMonth; month = addMonth(month, 1)) {
    for (const tx of transactions) {
      if (toYearMonth(tx.date) !== month || !tx.category_id) continue;
      const goalIds = categoryToGoalIds.get(tx.category_id);
      if (!goalIds) continue;
      for (const goalId of goalIds) {
        runningByGoal.set(goalId, (runningByGoal.get(goalId) ?? 0) + Math.abs(tx.amount_cents));
      }
    }
    if (month >= startMonth) {
      const row: GoalProgressSeriesPoint = { month: formatMonthLabel(month) };
      for (const g of linkedGoals) row[g.id] = runningByGoal.get(g.id) ?? 0;
      points.push(row);
    }
  }

  return { points, series };
}
