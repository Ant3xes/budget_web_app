/**
 * Runs `run()` only when every given id list is non-empty, otherwise
 * resolves to an empty result without querying — Supabase's `.in()` needs a
 * non-empty list, so every transactions query scoped to active accounts (and
 * sometimes also to a category id list) has to guard against an empty list
 * by hand. Centralizes that guard: this exact
 * `accountIds.length > 0 ? supabase...in("account_id", accountIds)... :
 * Promise.resolve({data: [...]})` shape had drifted into 8 independent
 * copies across app/(app)/dashboard/page.tsx and app/(app)/analytics/page.tsx
 * (found during a code-review pass on the dashboard account-scoping fix).
 */
export function runScopedQuery<T>(
  idLists: unknown[][],
  run: () => PromiseLike<{ data: T[] | null }>,
): PromiseLike<{ data: T[] | null }> {
  return idLists.every((ids) => ids.length > 0) ? run() : Promise.resolve({ data: [] as T[] });
}
