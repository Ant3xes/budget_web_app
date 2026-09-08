const MONTH_ABBR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export type TransferVolumeTx = {
  date: string; // YYYY-MM-DD
  amount_cents: number; // transfer_debit rows only — negative (money leaving the source account)
};

export type TransferVolumeSeriesPoint = { key: string; month: string; transferVolume: number };

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
 * Monthly total transfer *volume* — the sum of `transfer_debit` amounts
 * (absolute), i.e. how much money moved between the user's own accounts
 * that month. Not a net flow (a transfer's debit/credit pair always nets
 * to zero across all accounts, so it has no place in cash-flow's
 * income/expense math) — purely an activity metric, the 3rd bar issue #36
 * asks the cash-flow chart for. Same month-window shape (`key`/`month`) as
 * `computeIncomeExpenseSeries` so `CashflowChart` can zip the two series by
 * `key` — pass transactions already filtered to `kind === "transfer_debit"`
 * and the same window (see app/(app)/analytics/page.tsx).
 */
export function computeTransferVolumeSeries(
  transactions: TransferVolumeTx[],
  monthCount: number | null = 6,
  now: Date = new Date(),
  endMonth?: string,
): TransferVolumeSeriesPoint[] {
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

  const byMonth: Record<string, number> = {};
  for (let month = startMonth; month <= currentMonth; month = addMonth(month, 1)) byMonth[month] = 0;

  for (const tx of transactions) {
    const key = toYearMonth(tx.date);
    if (key in byMonth) byMonth[key] = (byMonth[key] ?? 0) + Math.abs(tx.amount_cents);
  }

  return Object.keys(byMonth)
    .sort()
    .map((key) => ({ key, month: formatMonthLabel(key), transferVolume: byMonth[key]! }));
}
