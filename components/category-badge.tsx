import { CATEGORY_COLOR_FALLBACK } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CategoryBadgeProps {
  name: string;
  color?: string | null;
  icon?: string | null;
  className?: string;
}

/**
 * Category icon + color-tinted name. Extracted from
 * components/budget/budget-list.tsx's markup (its exact `flex items-center
 * gap-2` layout, icon before name) — plan §Étape 2, wired here into
 * budget-list.tsx and the settings/categories page. The name text itself
 * carries the category color (instead of a separate dot), consolidated onto
 * this shared component from the previously hand-rolled dot markup in
 * transaction-list.tsx and the categories settings page.
 */
export function CategoryBadge({ name, color, icon, className }: CategoryBadgeProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {icon && <span>{icon}</span>}
      <span style={{ color: color ?? CATEGORY_COLOR_FALLBACK }}>{name}</span>
    </span>
  );
}
