interface ChartEmptyStateProps {
  className?: string;
}

/**
 * Shared "no data yet" placeholder for chart widgets — centralizes a block
 * that had drifted into 5 independent copies across
 * components/dashboard/bar-chart.tsx, components/accounts/balance-chart.tsx,
 * and the 3 new /analytics charts (plan §Étape 4 cleanup pass).
 */
export function ChartEmptyState({ className }: ChartEmptyStateProps) {
  return (
    <div className={`flex h-48 items-center justify-center text-sm text-muted-foreground ${className ?? ""}`}>
      Pas encore de données
    </div>
  );
}
