import Link from "next/link";

import { T } from "@/components/i18n/t";
import { buildDashboardHref } from "@/lib/dashboard/build-dashboard-href";

export type AnalyticsTab = "overview" | "categories" | "accounts" | "transactions" | "comparisons";

export const ANALYTICS_TABS: AnalyticsTab[] = ["overview", "categories", "accounts", "transactions", "comparisons"];

interface AnalyticsTabsProps {
  current: AnalyticsTab;
  /** Preserved on every tab link so switching tabs doesn't drop the active period (see app/(app)/analytics/page.tsx). */
  periodParam?: string;
}

/**
 * Onglets de `/analytics` (issue #36) — même mécanisme que `PeriodSelector`
 * (`Link` + `buildDashboardHref`, Server Component, pas de state client) :
 * chaque onglet est une vraie navigation, donc `page.tsx` ne fetch que les
 * données du tab actif au lieu de tout charger d'un coup (cible PRD < 2s).
 */
export function AnalyticsTabs({ current, periodParam }: AnalyticsTabsProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
      {ANALYTICS_TABS.map((tab) => {
        const isActive = tab === current;
        const href = buildDashboardHref("/analytics", {
          tab: tab === "overview" ? undefined : tab,
          period: periodParam,
        });
        return (
          <Link
            key={tab}
            href={href}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <T k={`analytics.tabs.${tab}`} />
          </Link>
        );
      })}
    </div>
  );
}
