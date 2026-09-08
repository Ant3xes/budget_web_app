import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared card chrome for dashboard widgets — now a thin `Card` wrapper (the
 * "Étape 2" migration flagged in this file's earlier comment). `Card` sets
 * vertical spacing itself via `--card-spacing`, but only its
 * `CardHeader`/`CardContent`/`CardFooter` sub-parts apply horizontal padding
 * — this wrapper's children are raw widget markup (no sub-parts), so
 * `px-(--card-spacing)` is added directly here to match.
 */
export function DashboardCard({ children, className }: DashboardCardProps) {
  return <Card className={cn("px-(--card-spacing)", className)}>{children}</Card>;
}
