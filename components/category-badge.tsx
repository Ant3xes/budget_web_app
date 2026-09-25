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
 * gap-2` layout, icon before name) — plan §Étape 2, wired here into
 * budget-list.tsx and the settings/categories page.
 *
 * The category color is shown as a dot, not as the text color: user-picked
 * colors (yellow, lime, cyan...) are far below the 4.5:1 WCAG AA contrast on
 * a white background when used for text.
 */
export function CategoryBadge({ name, color, icon, className }: CategoryBadgeProps) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      {icon && <span>{icon}</span>}
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? CATEGORY_COLOR_FALLBACK }}
      />
      <span>{name}</span>
    </span>
  );
}
