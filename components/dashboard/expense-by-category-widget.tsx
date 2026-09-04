import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DonutChart } from "@/components/dashboard/donut-chart";

interface ExpenseByCategoryWidgetProps {
  data: { name: string; value: number; color: string; icon?: string | null; categoryId: string | null }[];
  periodLabel: string;
}

/**
 * "Dépenses par catégorie" donut card. Extracted verbatim from
 * app/(app)/dashboard/page.tsx — plan §Étape 1 (structural extraction, no
 * visual change). Wiring DonutChart onto the shadcn `ChartContainer` +
 * validated palette is Étape 2. `periodLabel` reflects the global period
 * filter (plan §Étape 3, period-selector.tsx) instead of a hardcoded
 * "mois en cours"; slices now drill down into /expenses filtered on that
 * category (skipped for "Sans catégorie", `categoryId` null).
 */
export function ExpenseByCategoryWidget({ data, periodLabel }: ExpenseByCategoryWidgetProps) {
  return (
    <DashboardCard>
      <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Dépenses par catégorie ({periodLabel})
      </h2>
      <DonutChart data={data} emptyLabel="Aucune dépense sur la période" drillDownBasePath="/expenses" />
    </DashboardCard>
  );
}
