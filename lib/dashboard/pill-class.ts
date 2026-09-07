/**
 * Shared active/inactive pill styling for the dashboard's filter buttons —
 * `period-selector.tsx`'s preset links and `account-selector.tsx`'s account
 * toggles rendered the exact same class string independently; centralized so
 * a future restyle (color, radius) only needs one edit instead of two kept
 * in sync by hand.
 */
export function pillButtonClass(isActive: boolean): string {
  return `rounded-md px-3 py-1 text-sm transition-colors ${
    isActive
      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
  }`;
}
