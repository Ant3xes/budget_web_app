import type { ReactNode } from "react";

interface DashboardCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared card chrome for dashboard widgets — centralizes the
 * `rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900` wrapper that was
 * duplicated 7 times across the widget files extracted from
 * app/(app)/dashboard/page.tsx (plan §Étape 1). Deliberately NOT the shadcn
 * `Card` primitive (components/ui/card.tsx): swapping to `Card`'s own
 * tokens/styling is Étape 2 (visual polish) — this wrapper exists only to
 * de-duplicate the *current* look during the structural extraction, holding
 * this étape to zero visual change. Each widget still authors its own
 * heading (their `mb-2`/`mb-3`/no-margin variants genuinely differ), so only
 * the outer chrome is centralized here.
 */
export function DashboardCard({ children, className }: DashboardCardProps) {
  return (
    <article className={`rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900 ${className ?? ""}`}>
      {children}
    </article>
  );
}
