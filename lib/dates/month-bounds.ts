/**
 * Inclusive YYYY-MM-DD bounds for a calendar month (UTC, no TZ shift).
 */
export function monthBounds(yyyyMM: string): { from: string; to: string } {
  const [y, m] = yyyyMM.split("-").map(Number);
  const from = `${yyyyMM}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${yyyyMM}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}
