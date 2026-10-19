/** A Supabase list response: `error` is `null` when the query was skipped or succeeded. */
export type ScopedQueryResult<T> = { data: T[] | null; error?: { message: string; code?: string } | null };

/**
 * Runs `run()` only when every given id list is non-empty, otherwise
 * resolves to an empty result without querying — Supabase's `.in()` needs a
 * non-empty list, so every transactions query scoped to active accounts (and
 * sometimes also to a category id list) has to guard against an empty list
 * by hand. Centralizes that guard.
 *
 * The response keeps its `error` (issue 162): callers pass it through
 * `unwrap()` instead of reading `data ?? []`, which hid failures.
 */
export function runScopedQuery<T>(
  idLists: unknown[][],
  run: () => PromiseLike<ScopedQueryResult<T>>,
): PromiseLike<ScopedQueryResult<T>> {
  return idLists.every((ids) => ids.length > 0) ? run() : Promise.resolve({ data: [] as T[], error: null });
}
