export const dashboard = {
  title: "Dashboard",
  consolidatedBalance: "Consolidated balance",
  consolidatedBalanceFooter: "All accounts combined",
  noBank: "No bank set",
  allAccounts: "All accounts",
  remainingToLive: {
    label: "Left to live on (before charges)",
    footer: "({amount} accounting for upcoming charges)",
  },
  expenseIncome: {
    label: "Expenses / Income ({period})",
    expense: "Expenses",
    income: "Income",
  },
  savingsThisMonth: "Savings this month",
  expenseByCategory: {
    heading: "Expenses by category ({period})",
    empty: "No expenses over this period",
  },
  incomeVsExpense: {
    heading: "Income vs Expenses ({period})",
  },
  budgets: {
    heading: "This month's budgets",
    consumed: "Spent",
    remaining: "Remaining",
    noCategory: "Uncategorized",
  },
  fixedCharges: {
    heading: "Fixed charges (upcoming)",
    total: "Upcoming total this month",
    dueSoon: "Soon",
    empty: "No upcoming fixed charges",
  },
  recentTransactions: {
    heading: "Recent transactions",
    empty: "No transactions.",
    transfer: "Transfer",
    defaultDescription: "Transaction",
    itemLabel: "transaction",
  },
  savingsGoals: {
    heading: "Savings goals",
  },
  overlay: {
    categoryTitle: "{category} ({period})",
    budgetTitle: "{category} — this month's budget",
    empty: "No transactions.",
  },
} as const;
