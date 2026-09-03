import { CATEGORY_COLOR_FALLBACK } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  name: string;
  color?: string | null;
  icon?: string | null;
  className?: string;
}

/**
 * Category icon + color dot + name. Extracted from
 * components/budget/budget-list.tsx's markup (its exact `flex items-center
 * gap-2` layout, icon before dot) — plan §Étape 2, wired here into
 * budget-list.tsx and the dashboard's budget-utilization widget (which
 * previously showed icon+name only; adding the dot now makes it consistent
 * with the /budget page, a deliberate visual-polish change for this étape).
 * `components/transactions/transaction-list.tsx` has its own, differently
 * ordered variant (dot before icon, tighter gap) — left as-is, out of this
 * étape's scope.
 */
export function CategoryBadge({ name, color, icon, className }: CategoryBadgeProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {icon && <span>{icon}</span>}
      <span
        className="inline-block h-2 w-2 flex-shrink-0 rounded-full"
        style={{ backgroundColor: color ?? CATEGORY_COLOR_FALLBACK }}
      />
      {name}
    </span>
  );
}
