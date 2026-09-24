import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAllPages } from "@/lib/shared-expenses/fetch-all-pages";

/**
 * A shared expense shaped like the rows the dashboard/analytics "activity"
 * queries return for `transactions` (an expense, `kind: "expense"`). The pure
 * aggregation helpers (`computeExpenseByCategory`, `computeIncomeExpenseSeries`,
 * …) take `Math.abs` of expense amounts, so the positive `amount_cents` of a
 * shared expense feeds them unchanged.
 *
 * Never mix these rows into a *balance* computation: a shared expense sits on
 * no account of the shared space (it was paid from a member's personal account).
 */
export type ActivityRow = {
  /** The id of the source transaction — stable, and what the overlays key on. */
  id: string;
  date: string;
  description: string | null;
  kind: "expense";
  amount_cents: number;
  category_id: string | null;
  categories: unknown;
};

type SharedExpenseRow = {
  source_transaction_id: string;
  date: string;
  description: string | null;
  amount_cents: number;
  category_id: string | null;
  categories: unknown;
};

export const toActivityRow = (row: SharedExpenseRow): ActivityRow => ({
  id: row.source_transaction_id,
  date: row.date,
  description: row.description,
  kind: "expense",
  amount_cents: row.amount_cents,
  category_id: row.category_id,
  categories: row.categories,
});

export type ActivityRange = {
  from: string;
  to: string;
  /** `false` for a half-open window (`date < to`), like the "this month" budget query. Default: `date <= to`. */
  toInclusive?: boolean;
  /** Restrict to these categories; an empty list yields nothing (mirrors `runScopedQuery`). */
  categoryIds?: string[];
};

/**
 * The shared expenses of a shared space over a window, as activity rows.
 * Reads every page (PostgREST caps a response at 1000 rows), because the
 * totals built from them must be exhaustive.
 */
export const fetchSharedExpenseActivity = async (
  supabase: SupabaseClient,
  spaceId: string,
  range: ActivityRange,
): Promise<ActivityRow[]> => {
  if (range.categoryIds && range.categoryIds.length === 0) {
    return [];
  }

  const rows = await fetchAllPages<SharedExpenseRow>((from, to) => {
    let query = supabase
      .from("shared_expenses")
      .select(
        "source_transaction_id, date, description, amount_cents, category_id, categories(name, color, icon, is_default, translation_key)",
      )
      .eq("space_id", spaceId)
      .gte("date", range.from);

    query = range.toInclusive === false ? query.lt("date", range.to) : query.lte("date", range.to);
    if (range.categoryIds) {
      query = query.in("category_id", range.categoryIds);
    }

    return query.order("id").range(from, to);
  });

  return rows.map(toActivityRow);
};
