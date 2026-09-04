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

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });
}
