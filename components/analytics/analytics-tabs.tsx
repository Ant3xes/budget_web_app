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
    <div className="flex max-w-full flex-wrap items-center gap-1 rounded-lg border border-border p-1 sm:inline-flex">
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
            className={`inline-flex min-h-9 items-center whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] transition-colors sm:px-3 sm:text-sm md:min-h-0 ${
              isActive
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            <T k={`analytics.tabs.${tab}`} />
          </Link>
        );
      })}
    </div>
  );
}
