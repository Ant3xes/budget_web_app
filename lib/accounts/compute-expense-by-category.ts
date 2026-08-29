export type ExpenseByCategoryTx = {
  date: string; // YYYY-MM-DD
  amount_cents: number;
  categoryName: string | null;
  categoryColor: string | null;
};

export type ExpenseByCategoryPoint = {
  name: string;
  value: number; // cents (positive)
  color: string;
};

/**
 * Aggregate expense amounts by category for the given date window.
 * - `from` inclusive YYYY-MM-DD, or null for no lower bound
 * - `to` inclusive YYYY-MM-DD, or null for no upper bound
 */
export function computeExpenseByCategory(
  transactions: ExpenseByCategoryTx[],
  from: string | null = null,
  to: string | null = null,
): ExpenseByCategoryPoint[] {
  const byCat: Record<string, ExpenseByCategoryPoint> = {};

  for (const tx of transactions) {
    if (from && tx.date < from) continue;
    if (to && tx.date > to) continue;

    const name = tx.categoryName ?? "Sans catégorie";
    const color = tx.categoryColor ?? "#94a3b8";
    if (!byCat[name]) byCat[name] = { name, value: 0, color };
    byCat[name]!.value += Math.abs(tx.amount_cents);
  }

  return Object.values(byCat).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "fr"));
}
