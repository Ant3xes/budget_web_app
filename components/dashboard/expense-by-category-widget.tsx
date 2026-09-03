import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { DonutChart } from "@/components/dashboard/donut-chart";

interface ExpenseByCategoryWidgetProps {
  data: { name: string; value: number; color: string }[];
}

/**
 * "Dépenses par catégorie" donut card. Extracted verbatim from
 * app/(app)/dashboard/page.tsx — plan §Étape 1 (structural extraction, no
 * visual change). Wiring DonutChart onto the shadcn `ChartContainer` +
 * validated palette is Étape 2.
 */
export function ExpenseByCategoryWidget({ data }: ExpenseByCategoryWidgetProps) {
  return (
    <DashboardCard>
      <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Dépenses par catégorie (mois en cours)</h2>
      <DonutChart data={data} emptyLabel="Aucune dépense ce mois" />
    </DashboardCard>
  );
}
