/**
 * "/analytics" deep-dive page (app/(app)/analytics/page.tsx) and its 3
 * charts (components/analytics/*.tsx). The page title itself reuses
 * `nav.items.analytics` rather than duplicating "Analyses" here.
 */
export const analytics = {
  netWorth: {
    heading: "Net worth ({period})",
    seriesLabel: "Net worth",
  },
  cashflow: {
    heading: "Monthly cash flow ({period})",
    income: "Income",
    expense: "Expenses",
    net: "Net",
  },
  expenseTrend: {
    heading: "Expense trend ({period})",
    seriesLabel: "Expenses",
    vsPreviousMonth: "vs previous month",
  },
} as const;
