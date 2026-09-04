import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Earliest transaction date, or null with no transactions — needed to bound
 * the "tout" period preset (`periodBounds` would otherwise collapse it to a
 * single day with no `earliestDate`). Only worth the extra query when "tout"
 * is actually selected; shared by app/(app)/dashboard/page.tsx and
 * app/(app)/analytics/page.tsx, which both had this identical fetch inline.
 */
export async function resolveEarliestTransactionDate(supabase: SupabaseClient): Promise<string | null> {
  const { data } = await supabase
    .from("transactions")
    .select("date")
    .is("deleted_at", null)
    .order("date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data?.date ?? null;
}
