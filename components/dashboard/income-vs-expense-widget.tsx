import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { IncomeExpenseBarChart, type BarChartData } from "@/components/dashboard/bar-chart";

interface IncomeVsExpenseWidgetProps {
  data: BarChartData[];
}

/**
 * "Revenus vs Dépenses (6 mois)" bar chart card. Extracted verbatim from
 * app/(app)/dashboard/page.tsx — plan §Étape 1 (structural extraction, no
 * visual change). Wiring IncomeExpenseBarChart onto the shadcn
 * `ChartContainer` + validated palette is Étape 2.
 */
export function IncomeVsExpenseWidget({ data }: IncomeVsExpenseWidgetProps) {
  return (
    <DashboardCard>
      <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">Revenus vs Dépenses (6 mois)</h2>
      <IncomeExpenseBarChart data={data} />
    </DashboardCard>
  );
}
