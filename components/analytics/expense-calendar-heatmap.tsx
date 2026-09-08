"use client";

import { useLocale } from "@/components/locale-provider";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { formatEuros } from "@/lib/format";

export interface DailyExpensePoint {
  date: string; // YYYY-MM-DD
  amountCents: number; // 0 for a day with no expenses
}

interface ExpenseCalendarHeatmapProps {
  /** Every day of the target month, in order — see app/(app)/analytics/page.tsx. */
  days: DailyExpensePoint[];
}

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

/**
 * "Heatmap calendrier des dépenses quotidiennes" (issue #36) — the one
 * chart in this ticket with no recharts equivalent, built as a plain CSS
 * grid (7 columns, Monday-first to match `formatDate`'s fr-FR convention
 * used elsewhere) rather than SVG — a calendar of same-size cells has no
 * need for recharts' scales/axes machinery. Sequential-magnitude color job
 * (dataviz skill): one hue (`--expense`, already every other expense chart's
 * color) at 5 fixed opacity steps — never a rainbow, never lightness
 * computed per-cell from continuous data (that would defeat the validated,
 * discrete steps a legend can actually explain).
 */
export function ExpenseCalendarHeatmap({ days }: ExpenseCalendarHeatmapProps) {
  const { t } = useLocale();

  if (days.length === 0) return <ChartEmptyState />;

  const max = Math.max(...days.map((d) => d.amountCents), 0);
  const opacityFor = (cents: number) => {
    if (cents === 0 || max === 0) return 0;
    // 5 discrete steps rather than a continuous per-cell computation — a
    // reader can map "darker" to one of 5 named bands via the legend below,
    // not to an un-showable infinite gradient.
    const ratio = cents / max;
    if (ratio > 0.8) return 1;
    if (ratio > 0.6) return 0.8;
    if (ratio > 0.4) return 0.6;
    if (ratio > 0.2) return 0.4;
    return 0.2;
  };

  // Monday-first offset for the first day of the month.
  const firstWeekday = (new Date(`${days[0]!.date}T00:00:00Z`).getUTCDay() + 6) % 7;
  const leadingBlanks = Array.from({ length: firstWeekday }, (_, i) => `blank-${i}`);

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-zinc-400">
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i}>{label}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {leadingBlanks.map((key) => (
          <div key={key} />
        ))}
        {days.map((day) => {
          const dayOfMonth = Number(day.date.slice(8, 10));
          const opacity = opacityFor(day.amountCents);
          return (
            <div
              key={day.date}
              title={`${day.date} — ${formatEuros(day.amountCents)}`}
              className="flex aspect-square items-center justify-center rounded text-[10px] text-zinc-500 dark:text-zinc-400"
              style={{
                backgroundColor: opacity > 0 ? `color-mix(in srgb, var(--expense) ${opacity * 100}%, transparent)` : "var(--muted)",
              }}
            >
              {dayOfMonth}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-zinc-400">
        <span>{t("analytics.heatmap.less")}</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1].map((opacity) => (
          <span
            key={opacity}
            className="h-3 w-3 rounded"
            style={{
              backgroundColor: opacity > 0 ? `color-mix(in srgb, var(--expense) ${opacity * 100}%, transparent)` : "var(--muted)",
            }}
          />
        ))}
        <span>{t("analytics.heatmap.more")}</span>
      </div>
    </div>
  );
}
