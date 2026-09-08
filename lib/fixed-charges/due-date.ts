/**
 * Advances a `next_due_date` by exactly one billing period — the single
 * step app/api/fixed-charges/route.ts's `advanceDueDate` used to inline in
 * its own `while` loop (auto-advancing an overdue charge past today), and
 * that app/api/fixed-charges/[id]/pay/route.ts also needs on its own (moving
 * a charge to its next occurrence when the user marks it paid, regardless of
 * whether the current `next_due_date` is overdue, due today, or still in
 * the future — paying early is fine).
 */
export function advanceOnePeriod(dateStr: string, frequency: "monthly" | "quarterly" | "yearly"): string {
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  if (frequency === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
  else if (frequency === "quarterly") date.setUTCMonth(date.getUTCMonth() + 3);
  else date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().slice(0, 10);
}

/**
 * Repeatedly advances `dateStr` by one period (via `advanceOnePeriod`) while
 * `shouldAdvance` still says to — the catch-up loop shared by both callers
 * that need to walk a `next_due_date` forward past some point, which differ
 * only in *when* to stop:
 * - `GET /api/fixed-charges`'s `advanceDueDate`: stop as soon as the date
 *   isn't overdue, i.e. `shouldAdvance = (d) => d < today` — a charge due
 *   today is left alone, not bumped.
 * - `POST /api/fixed-charges/:id/pay`: the charge being paid should always
 *   move to a genuinely future occurrence, i.e. `shouldAdvance = (d) => d <= today`
 *   applied to the *already-advanced-once* value (paying is itself one step
 *   forward, even if the charge wasn't due yet — then this catches up any
 *   further periods it was also overdue by).
 *
 * `YYYY-MM-DD` strings compare correctly with plain `<`/`<=`, so this never
 * needs to parse a `Date` just to compare — unlike the two ad-hoc loops this
 * replaced, which each built their own `Date` for that.
 */
export function advanceWhile(
  dateStr: string,
  frequency: "monthly" | "quarterly" | "yearly",
  shouldAdvance: (dateStr: string) => boolean,
): string {
  let result = dateStr;
  while (shouldAdvance(result)) result = advanceOnePeriod(result, frequency);
  return result;
}

/**
 * Shared by components/fixed-charges/fixed-charges-list.tsx (the full
 * management table) and components/dashboard/fixed-charges-summary.tsx (the
 * compact dashboard widget) — previously only defined in the former.
 */
export function isDueSoon(iso: string): boolean {
  const due = new Date(iso + "T00:00:00Z");
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  return due <= in7;
}

export function formatFixedChargeDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}
