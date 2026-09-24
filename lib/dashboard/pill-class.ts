/**
 * Shared active/inactive pill styling for the dashboard's filter buttons —
 * `period-selector.tsx`'s preset links and `account-selector.tsx`'s account
 * toggles rendered the exact same class string independently; centralized so
 * a future restyle (color, radius) only needs one edit instead of two kept
 * in sync by hand.
 */
export function pillButtonClass(isActive: boolean): string {
  return `inline-flex min-h-9 items-center whitespace-nowrap rounded-md px-2.5 py-1 text-[13px] transition-colors sm:px-3 sm:text-sm md:min-h-0 ${
    isActive
      ? "bg-foreground text-background"
      : "text-muted-foreground hover:bg-muted"
  }`;
}
