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

/**
 * Swatches offered when picking a category or savings-goal color
 * (`components/settings/category-form.tsx`, `components/goals/goals-modal.tsx`).
 * Single source of truth — previously duplicated verbatim in both files.
 *
 * NOTE (dashboard redesign, plan §Étape 0): these hexes FAIL
 * `scripts/validate_palette.js` from the `dataviz` skill — chroma-floor FAIL
 * on the two grays (`#64748b`, `#94a3b8`), contrast WARN on ~6 swatches
 * against a white surface. Left unchanged here because these values are
 * already stored on live `categories`/`savings_goals` rows — replacing them
 * would silently recolor the user's existing data. Revisit as a deliberate,
 * confirmed change in Étape 2 (visual polish), not as a side effect of this
 * refactor.
 */
export const CATEGORY_COLOR_SWATCHES = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#f97316", "#06b6d4", "#6366f1", "#84cc16",
  "#f43f5e", "#64748b", "#94a3b8",
] as const;

/**
 * Fallback color for a category/goal with no `color` set — the last (gray)
 * swatch of CATEGORY_COLOR_SWATCHES. Wired into every existing call site that
 * previously hardcoded this literal (dashboard, settings/categories,
 * transaction list, budget list, compute-expense-by-category) — see plan
 * §Étape 0.
 */
export const CATEGORY_COLOR_FALLBACK = CATEGORY_COLOR_SWATCHES[CATEGORY_COLOR_SWATCHES.length - 1];

/**
 * Categorical chart series colors (8 slots) and financial/status semantics,
 * as CSS custom properties defined in `app/globals.css` — validated with
 * `scripts/validate_palette.js` from the `dataviz` skill against this app's
 * actual light/dark surfaces (all 6 checks pass in both modes). Order is the
 * CVD-safety mechanism: never reorder or cherry-pick a subset out of order.
 * Not yet wired into the existing Recharts components — introduced ahead of
 * the Étape 2 (visual polish) work that will consume them.
 */
export const CHART_SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
] as const;

export const INCOME_COLOR = "var(--income)";
export const EXPENSE_COLOR = "var(--expense)";

/**
 * Budget-rhythm colors (green → orange clair → orange foncé → rouge).
 * Named distinctly from `components/fixed-charges/fixed-charges-list.tsx`'s
 * local `STATUS_COLORS` (unrelated: active/suspended/cancelled badge classes)
 * to avoid two same-named, differently-shaped "status color" concepts.
 */
export const BUDGET_RHYTHM_COLORS = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  serious: "var(--status-serious)",
  critical: "var(--status-critical)",
} as const;
