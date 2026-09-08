const MONTH_ABBR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export type YoYTx = { date: string; kind: string; amount_cents: number };
export type YoYPoint = { key: string; month: string; current: number; previous: number };

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
  // Includes the year (unlike a bare month abbreviation) — a multi-year
  // custom range (PeriodSelectorCustom isn't limited to this page's
  // 6m/1a/tout presets) would otherwise repeat "Jan"/"Jan" across
  // different years with no way to tell them apart on the X axis.
  return `${MONTH_ABBR[mon - 1] ?? yyyyMM} ${yy}`;
}

/**
 * Month-by-month "this year vs the same month last year" (issue #36
 * "Comparaison année sur année"). Unlike this file's other series helpers,
 * the caller must fetch a *wider* window — the current window plus its
 * exact 12-months-earlier equivalent (see app/(app)/analytics/page.tsx) —
 * and pass all of it here in one `transactions` array; this only derives
 * which month keys count as "current" (the trailing `monthCount` months
 * ending at `endMonth`) vs "previous" (each of those, minus 12 months).
 *
 * `metric` picks which kind's amounts to sum (expenses shown positive).
 */
export function computeYearOverYear(
  transactions: YoYTx[],
  monthCount: number,
  now: Date = new Date(),
  endMonth?: string,
  metric: "expense" | "income" = "expense",
): YoYPoint[] {
  const currentMonth = endMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const startMonth = addMonth(currentMonth, -(monthCount - 1));

  const currentMonths: string[] = [];
  for (let month = startMonth; month <= currentMonth; month = addMonth(month, 1)) currentMonths.push(month);

  const totalsByMonth = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.kind !== metric) continue;
    const key = toYearMonth(tx.date);
    totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + Math.abs(tx.amount_cents));
  }

  return currentMonths.map((month) => ({
    key: month,
    month: formatMonthLabel(month),
    current: totalsByMonth.get(month) ?? 0,
    previous: totalsByMonth.get(addMonth(month, -12)) ?? 0,
  }));
}
