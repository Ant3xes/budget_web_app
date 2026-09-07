/**
 * Shared money/date formatting helpers, extracted from
 * app/(app)/dashboard/page.tsx while splitting it into independent widgets
 * (plan §Étape 1) so the new widget files don't each redefine their own
 * copy. Also wired into `formatEuros`'s identical duplicates in
 * components/dashboard/{bar-chart,donut-chart}.tsx (Étape 1),
 * components/budget/budget-list.tsx (Étape 2), and — since the Dashboard &
 * UX polish batch — goals-list.tsx, fixed-charges-list.tsx,
 * accounts-list.tsx, account-detail.tsx, transaction-list.tsx, and
 * transfer-list.tsx (the last 4 previously hardcoded/mis-formatted the
 * currency code instead of the € symbol; they now pass their row's own
 * `currency` as the second, optional argument — defaulted to "EUR" for every
 * caller above that never carried a per-row currency). `formatDate` was also
 * consolidated into transaction-list.tsx/transfer-list.tsx (identical
 * Europe/Paris formatting) in the same pass; account-detail.tsx's and
 * fixed-charges-list.tsx's own `formatDate` still genuinely diverge (UTC)
 * and stay un-consolidated — a separate cleanup outside this one's scope.
 */

export function formatEuros(cents: number, currency: string = "EUR"): string {
  try {
    return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency });
  } catch {
    // `currency` is free text on the account form (any 3-char string, no
    // character-class check — see accountSchema in account-form.tsx), and
    // `Intl`'s currency formatter throws for anything that isn't 3 alpha
    // characters. Degrade to a plain amount + raw code instead of crashing
    // every list that renders this account's amounts.
    return `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
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
