/** PostgREST returns at most this many rows per request (`max-rows`, 1000 by default). */
export const POSTGREST_PAGE_SIZE = 1000;

/**
 * Reads every row of a query by walking it in `range()` pages.
 *
 * The balance between members must be computed from *all* shared expenses and
 * settlements: a display list capped at N rows would silently give a wrong
 * balance once the history grows past N. The query must have a stable order
 * (e.g. by id) or pages can overlap or skip rows.
 */
export const fetchAllPages = async <T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error?: { message: string } | null }>,
  pageSize = POSTGREST_PAGE_SIZE,
): Promise<T[]> => {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) {
      return rows;
    }
  }
};
