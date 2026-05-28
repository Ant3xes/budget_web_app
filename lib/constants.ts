export const ACCOUNT_TYPES = [
  "courant",
  "épargne",
  "livret",
  "PEL",
  "autre",
] as const;

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/expenses", label: "Expenses" },
  { href: "/incomes", label: "Incomes" },
  { href: "/transfers", label: "Transfers" },
  { href: "/budget", label: "Budget" },
  { href: "/fixed-charges", label: "Fixed Charges" },
  { href: "/goals", label: "Goals" },
  { href: "/invitations", label: "Invitations" },
  { href: "/settings", label: "Settings" },
] as const;

export const PROTECTED_PATHS = NAV_ITEMS.map((item) => item.href);
