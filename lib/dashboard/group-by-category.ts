/** A transaction row shaped for the click-to-open overlays (donut + budget chart). */
export interface OverlayCandidate {
  id: string;
  date: string;
  description: string | null;
  category_id: string | null;
  amount_cents: number;
}

export type OverlayTransaction = { id: string; date: string; description: string | null; amount_cents: number };

/** Groups `id/date/description/amount_cents` rows by `category_id`, dropping rows with no category — feeds both overlay widgets. */
export function groupByCategoryId(rows: OverlayCandidate[]): Record<string, OverlayTransaction[]> {
  return rows.reduce<Record<string, OverlayTransaction[]>>((acc, row) => {
    if (!row.category_id) return acc;
    (acc[row.category_id] ??= []).push({ id: row.id, date: row.date, description: row.description, amount_cents: row.amount_cents });
    return acc;
  }, {});
}

/** Sums |amount_cents| by `category_id`, dropping rows with no category — used for linked-goal totals and budget consumption. */
export function sumAbsByCategoryId(rows: { category_id: string | null; amount_cents: number }[]): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    if (row.category_id) acc[row.category_id] = (acc[row.category_id] ?? 0) + Math.abs(row.amount_cents);
    return acc;
  }, {});
}
