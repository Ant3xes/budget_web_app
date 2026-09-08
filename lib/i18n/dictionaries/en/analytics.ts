/**
 * "/analytics" sandbox (issue #36 — app/(app)/analytics/page.tsx +
 * components/analytics/*.tsx), organized into tabs
 * (analytics-tabs.tsx): Overview / Categories / Accounts / Transactions /
 * Comparisons.
 */
export const analytics = {
  tabs: {
    overview: "Overview",
    categories: "Categories",
    accounts: "Accounts",
    transactions: "Transactions",
    comparisons: "Comparisons",
  },
  netWorth: {
    heading: "Net worth ({period})",
    seriesLabel: "Net worth",
  },
  cashflow: {
    heading: "Monthly cash-flow ({period})",
    income: "Income",
    expense: "Expenses",
    net: "Net",
    transferVolume: "Transfers",
  },
  expenseTrend: {
    heading: "Expense trend ({period})",
    seriesLabel: "Expenses",
    vsPreviousMonth: "vs previous month",
  },
  savingsRate: {
    heading: "Monthly savings rate ({period})",
    seriesLabel: "Savings rate",
  },
  categoryTrend: {
    heading: "Expense trend by category ({period})",
    others: "Others",
    uncategorized: "Uncategorized",
  },
  categoryBreakdown: {
    heading: "Expenses by category",
    thisMonth: "This month",
    yearToDate: "Year to date",
    empty: "No expenses",
  },
  budgetVsActual: {
    heading: "Budget vs actual (this month)",
    delta: "Delta",
    noCategory: "Uncategorized",
    over: "Over budget",
    under: "Remaining",
  },
  topCategories: {
    heading: "Top categories & recurring merchants ({period})",
    categoriesHeading: "Top categories",
    merchantsHeading: "Recurring merchants",
    empty: "Not enough data",
    occurrences: "({count}×)",
  },
  accountBreakdown: {
    heading: "Balances by bank / account",
    balance: "Balance",
  },
  fixedChargesShare: {
    heading: "Share of your left-to-live-on absorbed by fixed charges",
    noBalance: "No balance available on courant accounts",
    caption: "Upcoming fixed charges this month / courant accounts balance",
  },
  histogram: {
    heading: "Expense amount distribution (this month)",
    seriesLabel: "Number of expenses",
    tooltipCount: "{count} expense(s)",
  },
  heatmap: {
    heading: "Daily expenses (this month)",
    less: "Less",
    more: "More",
  },
  yearOverYear: {
    heading: "Year-over-year comparison (expenses)",
    current: "This year",
    previous: "Previous year",
  },
  goalProgress: {
    heading: "Savings goal progress ({period})",
    manualHeading: "Manual goals (current value)",
  },
} as const;
