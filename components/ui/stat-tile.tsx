import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string;
  /** Extra classes for the value text (e.g. `text-expense` for a negative amount). */
  valueClassName?: string;
  className?: string;
  /** Optional secondary line below the value (e.g. a parenthetical caveat) — kept as a free-form slot rather than a second typed prop, since its shape varies per caller. */
  footer?: ReactNode;
}

/**
 * A single-number KPI card (label + value). Per the `dataviz` skill's stat-tile
 * contract (references/marks-and-anatomy.md): sentence-case label, no trailing
 * colon, semibold value. No `delta`/`trend` yet — the dashboard doesn't compute
 * a "vs previous period" comparison until Étape 4 (tendance des dépenses).
 */
export function StatTile({ label, value, valueClassName, className, footer }: StatTileProps) {
  return (
    <Card className={className}>
      <CardContent>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-xl font-semibold", valueClassName)}>{value}</p>
        {footer}
      </CardContent>
    </Card>
  );
}
