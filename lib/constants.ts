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
 * against a white surface. Still left unchanged as of Étape 2: these values
 * are already stored on live `categories`/`savings_goals` rows, so
 * replacing them would silently recolor the user's existing data — a
 * product decision that deserves its own explicit call, not something to
 * fold into a broader visual-polish pass. Not scheduled against a specific
 * future étape; revisit deliberately if/when it comes up.
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
 * Fixed income/expense series colors, as CSS custom properties defined in
 * app/globals.css — validated with `scripts/validate_palette.js` from the
 * `dataviz` skill (plan §Étape 0). Wired into
 * components/dashboard/bar-chart.tsx's chart config (plan §Étape 2).
 *
 * The 8-slot categorical `--chart-1`..`--chart-8` ramp and the
 * `--status-good`/`-warning`/`-serious`/`-critical` status colors defined
 * alongside these in app/globals.css don't have a JS re-export here: nothing
 * consumes a categorical *series* palette yet (the donut chart uses each
 * category's own user-set `color`, not a fixed ramp — see donut-chart.tsx),
 * and the budget-rhythm status colors are consumed as Tailwind utility
 * classes (`bg-status-good` etc., see components/dashboard/budget-bar.tsx),
 * not as `var()` strings, so a JS constant holding the latter had zero
 * consumers. Reference the CSS custom properties directly (`var(--chart-1)`,
 * `bg-status-good`, ...) if/when a real consumer needs them.
 */
export const INCOME_COLOR = "var(--income)";
export const EXPENSE_COLOR = "var(--expense)";
