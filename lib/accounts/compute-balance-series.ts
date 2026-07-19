export type BalanceSeriesTx = {
  date: string; // YYYY-MM-DD
  amount_cents: number;
};

export type BalanceSeriesPoint = {
  month: string; // display label, e.g. "janv. 26"
  balance: number; // cents
};

function toYearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
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

function formatMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

/**
 * End-of-month balance series: for each month from the earliest transaction
 * (or current month if none) through the current month,
 * balance = initialBalanceCents + SUM(amount_cents where date <= end of month).
 */
export function computeBalanceSeries(
  transactions: BalanceSeriesTx[],
  initialBalanceCents: number,
  now: Date = new Date(),
): BalanceSeriesPoint[] {
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let startMonth = currentMonth;
  if (transactions.length > 0) {
    const earliest = transactions.reduce((min, tx) => (tx.date < min ? tx.date : min), transactions[0].date);
    startMonth = toYearMonth(earliest);
  }

  const points: BalanceSeriesPoint[] = [];
  for (let month = startMonth; month <= currentMonth; month = addMonth(month, 1)) {
    const cutoff = endOfMonth(month);
    const sum = transactions
      .filter((tx) => tx.date <= cutoff)
      .reduce((acc, tx) => acc + tx.amount_cents, 0);
    points.push({
      month: formatMonthLabel(month),
      balance: initialBalanceCents + sum,
    });
  }

  return points;
}
