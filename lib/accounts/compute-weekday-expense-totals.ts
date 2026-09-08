export type WeekdayExpenseTx = { date: string; amount_cents: number };

export type WeekdayExpenseTotal = {
  /** Short weekday label, e.g. "Lun". */
  label: string;
  totalCents: number;
};

// Monday-first, matching ExpenseCalendarHeatmap's own weekday convention
// (fr-FR calendars start the week on Monday, unlike JS's Date.getDay()).
const WEEKDAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/**
 * Sums expense amounts by day of week (Monday->Sunday) for the "Dépenses
 * par jour de la semaine" chart (issue #42) — surfaces a weekly rhythm
 * (e.g. weekend vs weekday spending) that a monthly amount histogram can't
 * show. Dates are parsed as UTC midnight — same convention as the other
 * date-keyed helpers in this directory (e.g. compute-balance-series.ts) —
 * since transaction dates are plain YYYY-MM-DD strings with no time
 * component, so there's no local-timezone offset to account for.
 */
export function computeWeekdayExpenseTotals(transactions: WeekdayExpenseTx[]): WeekdayExpenseTotal[] {
  const totals = new Array<number>(7).fill(0);

  for (const tx of transactions) {
    const jsWeekday = new Date(`${tx.date}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
    const mondayFirstIndex = (jsWeekday + 6) % 7; // 0=Mon..6=Sun
    totals[mondayFirstIndex] += Math.abs(tx.amount_cents);
  }

  return WEEKDAY_LABELS.map((label, i) => ({ label, totalCents: totals[i]! }));
}
