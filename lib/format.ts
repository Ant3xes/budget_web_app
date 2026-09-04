/**
 * Shared money/date formatting helpers, extracted from
 * app/(app)/dashboard/page.tsx while splitting it into independent widgets
 * (plan §Étape 1) so the new widget files don't each redefine their own
 * copy. Also wired into `formatEuros`'s identical duplicates in
 * components/dashboard/{bar-chart,donut-chart}.tsx (Étape 1) and
 * components/budget/budget-list.tsx (Étape 2). Not wired into the remaining
 * places in the repo that duplicate this formatting (goals-list.tsx,
 * accounts-list.tsx, account-detail.tsx, fixed-charges-list.tsx,
 * transaction-list.tsx) — untouched so far, and some of their `formatDate`
 * variants genuinely diverge (UTC vs Europe/Paris), so that's a larger,
 * separate cleanup outside the dashboard's own scope.
 */

export function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

/**
 * Compact euro axis label for chart Y-axis ticks — cents to "1 234€" or,
 * above 10 000€, "12k€". Extracted from bar-chart.tsx (Étape 4) where it was
 * the first of what became 4 independent copies (net-worth-chart.tsx,
 * cashflow-chart.tsx, expense-trend-chart.tsx) once /analytics reused the
 * same tick shape — centralized here so a future formatting tweak (e.g. the
 * 10k threshold) only needs one edit.
 */
export function formatEurosAxisTick(cents: number): string {
  const euros = cents / 100;
  if (Math.abs(euros) >= 10_000) {
    return `${(euros / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}k€`;
  }
  return `${euros.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}
