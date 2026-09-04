const MONTH_ABBR = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

export type IncomeExpenseSeriesTx = {
  date: string; // YYYY-MM-DD
  kind: string;
  amount_cents: number;
};

export type IncomeExpenseSeriesPoint = {
  key: string; // YYYY-MM
  month: string; // e.g. "Jan 26"
  income: number; // cents
  expense: number; // cents (positive)
};

function toYearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function addMonth(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(yyyyMM: string): string {
  const mon = parseInt(yyyyMM.slice(5, 7), 10);
  const yy = yyyyMM.slice(2, 4);
  return `${MONTH_ABBR[mon - 1] ?? yyyyMM} ${yy}`;
}

/**
 * Monthly income vs expense totals.
 * - `monthCount` number: last N months ending at `endMonth` (defaults to `now`'s month)
 * - `monthCount` null: from earliest transaction (or `endMonth` if none) through `endMonth`
 * Only `expense` and `income` kinds count; transfers are ignored.
 *
 * `endMonth` matters for a past custom date range (dashboard/analytics'
 * "Personnalisé" period picker): without it, this always assumed the window
 * ends "now", so selecting e.g. mars–mai while today is septembre would
 * silently bucket transactions into juillet–septembre instead.
 */
export function computeIncomeExpenseSeries(
  transactions: IncomeExpenseSeriesTx[],
  monthCount: number | null = 6,
  now: Date = new Date(),
  endMonth?: string,
): IncomeExpenseSeriesPoint[] {
  const currentMonth = endMonth ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  let startMonth = currentMonth;
  if (monthCount === null) {
    if (transactions.length > 0) {
      const earliest = transactions.reduce(
        (min, tx) => (tx.date < min ? tx.date : min),
        transactions[0].date,
      );
      startMonth = toYearMonth(earliest);
    }
  } else {
    startMonth = addMonth(currentMonth, -(monthCount - 1));
  }

  const byMonth: Record<string, { income: number; expense: number }> = {};
  for (let month = startMonth; month <= currentMonth; month = addMonth(month, 1)) {
    byMonth[month] = { income: 0, expense: 0 };
  }

  for (const tx of transactions) {
    const key = toYearMonth(tx.date);
    const bucket = byMonth[key];
    if (!bucket) continue;
    if (tx.kind === "income") {
      bucket.income += tx.amount_cents;
    } else if (tx.kind === "expense") {
      bucket.expense += Math.abs(tx.amount_cents);
    }
  }

  return Object.keys(byMonth)
    .sort()
    .map((key) => ({
      key,
      month: formatMonthLabel(key),
      income: byMonth[key]!.income,
      expense: byMonth[key]!.expense,
    }));
}
