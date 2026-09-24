import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Earliest transaction date, or null with no transactions — needed to bound
 * the "tout" period preset (`periodBounds` would otherwise collapse it to a
 * single day with no `earliestDate`). Only worth the extra query when "tout"
 * is actually selected; shared by app/(app)/dashboard/page.tsx and
 * app/(app)/analytics/page.tsx, which both had this identical fetch inline.
 *
 * `spaceId` scopes the search to the active space (RLS only guarantees membership).
 *
 * `accountIds`, when passed, scopes the search to those accounts — deleting
 * an account excludes it from every dashboard figure (explicit decision,
 * code-review pass on the dashboard account-scoping fix), including "tout"'s
 * own start date: without this, a deleted account's very first transaction
 * could still stretch "tout" back further than the now-scoped charts have
 * any data for. An empty (non-null) `accountIds` means "no active accounts"
 * — short-circuits to null without querying, consistent with every other
 * account-scoped query on these pages.
 *
 * `options.includeSharedExpenses` (shared spaces only) also considers the
 * space's shared expenses and returns the earliest of the two.
 */
export async function resolveEarliestTransactionDate(
  supabase: SupabaseClient,
  spaceId: string,
  accountIds?: string[],
  options: { includeSharedExpenses?: boolean } = {},
): Promise<string | null> {
  const transactionDate = async () => {
    if (accountIds && accountIds.length === 0) return null;

    let query = supabase.from("transactions").select("date").eq("space_id", spaceId).is("deleted_at", null);
    if (accountIds) query = query.in("account_id", accountIds);

    const { data } = await query.order("date", { ascending: true }).limit(1).maybeSingle();
    return (data?.date as string | undefined) ?? null;
  };

  // Shared expenses sit on no account, so the account scoping above never
  // applies to them; a shared space that has only shared expenses (or no
  // courant account) must still get a real "tout" start date.
  const sharedExpenseDate = async () => {
    if (!options.includeSharedExpenses) return null;

    const { data } = await supabase
      .from("shared_expenses")
      .select("date")
      .eq("space_id", spaceId)
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle();
    return (data?.date as string | undefined) ?? null;
  };

  const [fromTransactions, fromSharedExpenses] = await Promise.all([transactionDate(), sharedExpenseDate()]);
  if (!fromTransactions || !fromSharedExpenses) return fromTransactions ?? fromSharedExpenses;

  // Both are ISO strings but not always the same shape (date vs timestamptz).
  return Date.parse(fromSharedExpenses) < Date.parse(fromTransactions) ? fromSharedExpenses : fromTransactions;
}
