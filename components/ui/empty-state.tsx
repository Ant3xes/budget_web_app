import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

/**
 * Shared "nothing here yet" panel — replaces the near-identical dashed-border
 * block duplicated across budget/goals/fixed-charges/import-rules/accounts
 * (each with its own radius: `rounded-lg` in 4 places, `rounded-xl` in
 * accounts). One radius, one recipe, optional icon/action slot.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-12 text-center",
        className
      )}
    >
      {Icon && <Icon className="size-8 text-muted-foreground/60" aria-hidden />}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
