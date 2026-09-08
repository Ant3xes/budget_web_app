/**
 * "/analytics" bac à sable (issue #36 — app/(app)/analytics/page.tsx +
 * components/analytics/*.tsx), organisé en onglets
 * (analytics-tabs.tsx) : Vue d'ensemble / Catégories / Comptes /
 * Transactions / Comparaisons.
 */
export const analytics = {
  tabs: {
    overview: "Vue d'ensemble",
    categories: "Catégories",
    accounts: "Comptes",
    transactions: "Transactions",
    comparisons: "Comparaisons",
  },
  netWorth: {
    heading: "Patrimoine net ({period})",
    seriesLabel: "Patrimoine net",
  },
  cashflow: {
    heading: "Cash-flow mensuel ({period})",
    income: "Revenus",
    expense: "Dépenses",
    net: "Net",
    transferVolume: "Virements",
  },
  expenseTrend: {
    heading: "Tendance des dépenses ({period})",
    seriesLabel: "Dépenses",
    vsPreviousMonth: "vs mois précédent",
  },
  savingsRate: {
    heading: "Taux d'épargne mensuel ({period})",
    seriesLabel: "Taux d'épargne",
  },
  categoryTrend: {
    heading: "Tendance des dépenses par catégorie ({period})",
    others: "Autres",
    uncategorized: "Sans catégorie",
  },
  categoryBreakdown: {
    heading: "Répartition des dépenses par catégorie",
    thisMonth: "Mois courant",
    yearToDate: "Cumul annuel",
    empty: "Aucune dépense",
  },
  budgetVsActual: {
    heading: "Budget vs réalisé (mois en cours)",
    delta: "Écart",
    noCategory: "Sans catégorie",
    over: "Dépassement",
    under: "Restant",
  },
  topCategories: {
    heading: "Top catégories & marchands récurrents ({period})",
    categoriesHeading: "Top catégories",
    merchantsHeading: "Marchands récurrents",
    empty: "Pas assez de données",
    occurrences: "({count} fois)",
  },
  accountBreakdown: {
    heading: "Répartition des soldes par banque / compte",
    balance: "Solde",
  },
  fixedChargesShare: {
    heading: "Part du reste-à-vivre absorbée par les charges fixes",
    noBalance: "Aucun solde disponible sur les comptes courants",
    caption: "Charges fixes à venir ce mois / solde des comptes courants",
  },
  histogram: {
    heading: "Distribution des montants de dépenses (ce mois)",
    seriesLabel: "Nombre de dépenses",
    tooltipCount: "{count} dépense(s)",
  },
  heatmap: {
    heading: "Dépenses quotidiennes (ce mois)",
    less: "Moins",
    more: "Plus",
  },
  yearOverYear: {
    heading: "Comparaison année sur année (dépenses)",
    current: "Cette année",
    previous: "Année précédente",
  },
  goalProgress: {
    heading: "Progression des objectifs d'épargne ({period})",
    manualHeading: "Objectifs manuels (valeur actuelle)",
  },
} as const;
