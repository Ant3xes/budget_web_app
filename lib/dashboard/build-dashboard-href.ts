/**
 * Builds a `/dashboard`-style href/URL from its filter query params, dropping
 * only params that are `undefined` — shared by every control that navigates
 * the dashboard's (and, for `period`, /analytics') own filters: the preset
 * `<Link>`s and the "Personnalisé" range in `period-selector*.tsx`, and the
 * new courant-accounts `account-selector.tsx`. Centralized so changing one
 * filter (e.g. toggling an account) never silently drops another (e.g. the
 * current period) — see the plan's §1.6 rationale.
 *
 * An empty string is a meaningful, distinct value here — not the same as
 * "omit this filter" — because `account-selector.tsx` uses it to represent
 * "every account deselected" (as opposed to `undefined`, which it sends for
 * "all accounts selected", the default/reset state). Dropping empty strings
 * like `undefined` would silently turn "select none" back into "select all"
 * the moment the last account is toggled off.
 */
export function buildDashboardHref(basePath: string, params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, value);
  }
  const queryString = query.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}
