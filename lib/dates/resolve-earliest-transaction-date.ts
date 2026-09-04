import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Earliest transaction date, or null with no transactions — needed to bound
 * the "tout" period preset (`periodBounds` would otherwise collapse it to a
 * single day with no `earliestDate`). Only worth the extra query when "tout"
 * is actually selected; shared by app/(app)/dashboard/page.tsx and
 * app/(app)/analytics/page.tsx, which both had this identical fetch inline.
 *
 * `accountIds`, when passed, scopes the search to those accounts — deleting
 * an account excludes it from every dashboard figure (explicit decision,
 * code-review pass on the dashboard account-scoping fix), including "tout"'s
 * own start date: without this, a deleted account's very first transaction
 * could still stretch "tout" back further than the now-scoped charts have
 * any data for. An empty (non-null) `accountIds` means "no active accounts"
 * — short-circuits to null without querying, consistent with every other
 * account-scoped query on these pages.
 */
export async function resolveEarliestTransactionDate(
  supabase: SupabaseClient,
  accountIds?: string[],
): Promise<string | null> {
  if (accountIds && accountIds.length === 0) return null;

  let query = supabase.from("transactions").select("date").is("deleted_at", null);
  if (accountIds) query = query.in("account_id", accountIds);

  const { data } = await query.order("date", { ascending: true }).limit(1).maybeSingle();
  return data?.date ?? null;
}
