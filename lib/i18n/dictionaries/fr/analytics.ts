/**
 * "/analytics" deep-dive page (app/(app)/analytics/page.tsx) and its 3
 * charts (components/analytics/*.tsx). The page title itself reuses
 * `nav.items.analytics` rather than duplicating "Analyses" here.
 */
export const analytics = {
  netWorth: {
    heading: "Patrimoine net ({period})",
    seriesLabel: "Patrimoine net",
  },
  cashflow: {
    heading: "Cash-flow mensuel ({period})",
    income: "Revenus",
    expense: "Dépenses",
    net: "Net",
  },
  expenseTrend: {
    heading: "Tendance des dépenses ({period})",
    seriesLabel: "Dépenses",
    vsPreviousMonth: "vs mois précédent",
  },
} as const;
