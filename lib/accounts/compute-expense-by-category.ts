import { CATEGORY_COLOR_FALLBACK } from "@/lib/constants";

export type ExpenseByCategoryTx = {
  /** Required only when `from`/`to` are passed to filter by date — the dashboard (plan §Étape 3) already filters at the SQL layer and omits it. */
  date?: string; // YYYY-MM-DD
  amount_cents: number;
  categoryName: string | null;
  categoryColor: string | null;
  /** Optional: unused by account-detail.tsx, carried through for the dashboard's category drill-down (plan §Étape 3). */
  categoryId?: string | null;
};

export type ExpenseByCategoryPoint = {
  name: string;
  value: number; // cents (positive)
  color: string;
  /** Always set (falls back to `null`), even when the input tx didn't carry one. */
  categoryId: string | null;
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
    if (from && (!tx.date || tx.date < from)) continue;
    if (to && (!tx.date || tx.date > to)) continue;

    const name = tx.categoryName ?? "Sans catégorie";
    const color = tx.categoryColor ?? CATEGORY_COLOR_FALLBACK;
    if (!byCat[name]) byCat[name] = { name, value: 0, color, categoryId: tx.categoryId ?? null };
    byCat[name]!.value += Math.abs(tx.amount_cents);
  }

  return Object.values(byCat).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "fr"));
}
