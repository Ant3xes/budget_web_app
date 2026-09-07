import Link from "next/link";

import { currentMonth, type Period, type PeriodPreset } from "@/lib/dates/period";
import { T } from "@/components/i18n/t";
import { PeriodSelectorCustom } from "@/components/period-selector-custom";
import { buildDashboardHref } from "@/lib/dashboard/build-dashboard-href";
import { pillButtonClass } from "@/lib/dashboard/pill-class";

interface PeriodSelectorProps {
  current: Period;
  /** Page to link back to with the new `?period=` — e.g. "/dashboard" or "/analytics" (plan §Étape 4). */
  basePath: string;
  /** Which preset options to render — defaults to the full list. */
  presets?: PeriodPreset[];
  /**
   * Current `?accounts=` value (raw, comma-separated ids), preserved on every
   * preset link and forwarded to `PeriodSelectorCustom` — only set on
   * /dashboard, which has an account selector; /analytics doesn't pass this.
   */
  accountsParam?: string;
}

const DEFAULT_PRESETS: PeriodPreset[] = ["1m", "3m", "6m", "1a", "tout"];

/**
 * Shared period filter (plan §Étape 3, generalized in §Étape 4 to also
 * serve /analytics via `basePath`) — reuses `lib/dates/period.ts` (types +
 * date math already shared with the /accounts/[id] page) rather than a new
 * date-range model. Built as plain `<Link>`s, not a client component with
 * local state like account-detail.tsx's picker: both /dashboard and
 * /analytics are Server Components that re-fetch from Supabase per period,
 * so a normal navigation (re-rendering the RSC tree) is the right
 * mechanism here, not client-side history rewriting.
 *
 * On /dashboard, scopes the KPI row, the category donut, and the
 * income/expense trend — the three widgets that are genuinely "a flow over
 * a time window". Solde consolidé (a snapshot, not a window), Budgets du
 * mois en cours (envelopes are inherently calendar-month, not rangeable),
 * Comptes par banque, and Dernières transactions (a recency feed, not a
 * period view) intentionally stay unscoped — same distinction
 * account-detail.tsx already draws between its period-filtered transaction
 * lists and the account's always-current balance. On /analytics, every
 * widget is itself "a flow over a time window", so all three widgets there
 * are scoped by it (each still floors to its own minimum window, same
 * pattern as the dashboard trend chart — see analytics/page.tsx).
 */
export function PeriodSelector({ current, basePath, presets = DEFAULT_PRESETS, accountsParam }: PeriodSelectorProps) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 p-1 dark:border-zinc-700">
      {presets.map((preset) => {
        const isActive =
          preset === "1m"
            ? current.type === "month" && current.month === currentMonth()
            : current.type === "preset" && current.value === preset;
        const href = buildDashboardHref(basePath, {
          period: preset === "1m" ? undefined : preset,
          accounts: accountsParam,
        });

        return (
          <Link key={preset} href={href} className={pillButtonClass(isActive)}>
            <T k={`periodSelector.presets.${preset}`} />
          </Link>
        );
      })}
      {/* Real separator (plan §1.4) — the "Personnalisé" block only picks up
          its own active/inverted color after "Appliquer" is clicked, so it
          can't be the only thing marking it as a distinct control group
          while the user is still editing the two month inputs. */}
      <div aria-hidden className="mx-1 w-px self-stretch bg-zinc-200 dark:bg-zinc-700" />
      <PeriodSelectorCustom current={current} basePath={basePath} accountsParam={accountsParam} />
    </div>
  );
}
