import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { IncomeExpenseBarChart, type BarChartData } from "@/components/dashboard/bar-chart";

interface IncomeVsExpenseWidgetProps {
  data: BarChartData[];
  periodLabel: string;
}

/**
 * "Revenus vs Dépenses" bar chart card. Extracted verbatim from
 * app/(app)/dashboard/page.tsx — plan §Étape 1 (structural extraction, no
 * visual change). Wiring IncomeExpenseBarChart onto the shadcn
 * `ChartContainer` + validated palette is Étape 2. `periodLabel` reflects
 * the global period filter (plan §Étape 3, period-selector.tsx) instead of
 * a hardcoded "6 mois".
 */
export function IncomeVsExpenseWidget({ data, periodLabel }: IncomeVsExpenseWidgetProps) {
  return (
    <DashboardCard>
      <h2 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Revenus vs Dépenses ({periodLabel})
      </h2>
      <IncomeExpenseBarChart data={data} />
    </DashboardCard>
  );
}
