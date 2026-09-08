export const dashboard = {
  title: "Tableau de bord",
  consolidatedBalance: "Solde consolidé",
  consolidatedBalanceFooter: "Tous comptes confondus",
  noBank: "Sans banque renseignée",
  allAccounts: "Tous les comptes",
  accountsOverview: {
    heading: "Vue d'ensemble des comptes",
  },
  accountFilter: {
    heading: "Filtrer les widgets ci-dessous par compte",
  },
  remainingToLive: {
    label: "Reste à vivre — mois en cours (hors charges)",
    afterChargesLabel: "Avec charges à venir",
  },
  expenseIncome: {
    label: "Dépenses / Revenus ({period})",
    expense: "Dépenses",
    income: "Revenus",
  },
  savingsThisMonth: "Épargne ce mois",
  expenseByCategory: {
    heading: "Dépenses par catégorie ({period})",
    empty: "Aucune dépense sur la période",
  },
  incomeVsExpense: {
    heading: "Revenus vs Dépenses ({period})",
  },
  budgets: {
    heading: "Budgets du mois en cours",
    consumed: "Consommé",
    remaining: "Restant",
    noCategory: "Sans catégorie",
  },
  fixedCharges: {
    heading: "Charges fixes (ce mois)",
    total: "Total à venir ce mois",
    dueSoon: "Bientôt",
    empty: "Aucune charge fixe ce mois-ci",
    paidBadge: "Payée",
  },
  recentTransactions: {
    heading: "Dernières transactions",
    empty: "Aucune transaction.",
    transfer: "Virement",
    defaultDescription: "Transaction",
    itemLabel: "transaction",
  },
  savingsGoals: {
    heading: "Objectifs d'épargne",
  },
  overlay: {
    categoryTitle: "{category} ({period})",
    budgetTitle: "{category} — budget du mois",
    empty: "Aucune transaction.",
  },
} as const;
