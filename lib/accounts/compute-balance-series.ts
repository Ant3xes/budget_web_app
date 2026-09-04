export type BalanceSeriesTx = {
  date: string; // YYYY-MM-DD
  amount_cents: number;
};

export type BalanceSeriesPoint = {
  month: string; // display label, e.g. "janv. 26"
  balance: number; // cents
};

export type DailyBalancePoint = {
  date: string; // YYYY-MM-DD
  label: string; // axis label
  balance: number; // cents
};

function toDateOnly(value: string): string {
  return value.slice(0, 10);
}

function toYearMonth(isoDate: string): string {
  return toDateOnly(isoDate).slice(0, 7);
}

function endOfMonth(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yyyyMM}-${String(lastDay).padStart(2, "0")}`;
}

function addMonth(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + delta));
  return next.toISOString().slice(0, 10);
}

function formatMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

function formatDayLabel(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * End-of-month balance series: for each month from the earliest transaction
 * (or `endMonth` if none) through `endMonth` (defaults to `now`'s month),
 * balance = initialBalanceCents + SUM(amount_cents where date <= end of month).
 *
 * `endMonth` matters when a caller slices the tail of this series for a
 * window that doesn't end "now" (e.g. /analytics' net-worth chart for a
 * past custom date range) — without it, the series always ran through
 * today, so slicing its last N months would grab the wrong months entirely.
 */
export function computeBalanceSeries(
  transactions: BalanceSeriesTx[],
  initialBalanceCents: number,
  now: Date = new Date(),
  endMonth?: string,
): BalanceSeriesPoint[] {
  const currentMonth = endMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let startMonth = currentMonth;
  if (transactions.length > 0) {
    const earliest = transactions.reduce(
      (min, tx) => (toDateOnly(tx.date) < min ? toDateOnly(tx.date) : min),
      toDateOnly(transactions[0].date),
    );
    startMonth = toYearMonth(earliest);
  }

  const points: BalanceSeriesPoint[] = [];
  for (let month = startMonth; month <= currentMonth; month = addMonth(month, 1)) {
    const cutoff = endOfMonth(month);
    const sum = transactions
      .filter((tx) => toDateOnly(tx.date) <= cutoff)
      .reduce((acc, tx) => acc + tx.amount_cents, 0);
    points.push({
      month: formatMonthLabel(month),
      balance: initialBalanceCents + sum,
    });
  }

  return points;
}

/**
 * Daily balance series for [from, to] inclusive.
 * Balance on day D = initial + SUM(amount_cents where date <= D).
 */
export function computeDailyBalanceSeries(
  transactions: BalanceSeriesTx[],
  initialBalanceCents: number,
  from: string,
  to: string,
): DailyBalancePoint[] {
  if (from > to) return [];

  const byDay = new Map<string, number>();
  let before = 0;
  for (const tx of transactions) {
    const dayKey = toDateOnly(tx.date);
    if (dayKey < from) {
      before += tx.amount_cents;
    } else if (dayKey <= to) {
      byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + tx.amount_cents);
    }
  }

  let running = initialBalanceCents + before;
  const points: DailyBalancePoint[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    running += byDay.get(day) ?? 0;
    points.push({
      date: day,
      label: formatDayLabel(day),
      balance: running,
    });
  }
  return points;
}
