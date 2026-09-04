import Link from "next/link";

import { PERIOD_PRESET_LABELS, currentMonth, type Period, type PeriodPreset } from "@/lib/dates/period";

interface PeriodSelectorProps {
  current: Period;
}

const PRESETS: PeriodPreset[] = ["1m", "3m", "6m", "1a", "tout"];

/**
 * Dashboard period filter (plan §Étape 3) — reuses `lib/dates/period.ts`
 * (types + date math already shared with the /accounts/[id] page) rather
 * than a new date-range model. Built as plain `<Link>`s, not a client
 * component with local state like account-detail.tsx's picker: the
 * dashboard is a Server Component that re-fetches from Supabase per period,
 * so a normal navigation (re-rendering the RSC tree) is the right
 * mechanism here, not client-side history rewriting.
 *
 * Scopes the KPI row, the category donut, and the income/expense trend —
 * the three widgets that are genuinely "a flow over a time window". Solde
 * consolidé (a snapshot, not a window), Budgets du mois en cours (envelopes
 * are inherently calendar-month, not rangeable), Comptes par banque, and
 * Dernières transactions (a recency feed, not a period view) intentionally
 * stay unscoped — same distinction account-detail.tsx already draws between
 * its period-filtered transaction lists and the account's always-current
 * balance.
 */
export function PeriodSelector({ current }: PeriodSelectorProps) {
  return (
    <div className="inline-flex gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
      {PRESETS.map((preset) => {
        const isActive =
          preset === "1m"
            ? current.type === "month" && current.month === currentMonth()
            : current.type === "preset" && current.value === preset;
        const href = preset === "1m" ? "/dashboard" : `/dashboard?period=${preset}`;

        return (
          <Link
            key={preset}
            href={href}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              isActive
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {PERIOD_PRESET_LABELS[preset]}
          </Link>
        );
      })}
    </div>
  );
}
