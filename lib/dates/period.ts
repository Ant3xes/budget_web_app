export type PeriodPreset = "1m" | "3m" | "6m" | "1a" | "2a" | "tout";

export type Period =
  | { type: "preset"; value: PeriodPreset }
  | { type: "month"; month: string } // YYYY-MM
  | { type: "range"; from: string; to: string }; // each YYYY-MM, inclusive

export const PERIOD_PRESET_LABELS: Record<PeriodPreset, string> = {
  "1m": "Ce mois",
  "3m": "3 mois",
  "6m": "6 mois",
  "1a": "1 an",
  "2a": "2 ans",
  "tout": "Tout",
};

const PRESET_MONTHS: Record<PeriodPreset, number | null> = {
  "1m": 1,
  "3m": 3,
  "6m": 6,
  "1a": 12,
  "2a": 24,
  "tout": null,
};

export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function isPeriodPreset(value: string): value is PeriodPreset {
  return value in PRESET_MONTHS;
}

export function isYearMonth(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;
  const month = Number(value.slice(5, 7));
  return month >= 1 && month <= 12;
}

/**
 * A "Personnalisé" range, encoded as a single `?period=` value —
 * `YYYY-MM:YYYY-MM` — so the existing single query key stays compatible
 * with bookmarks/links built against the `month`/`preset` cases. Requires
 * both halves to be valid year-months and `from` to not be after `to`
 * (lexicographic comparison works directly on `YYYY-MM` strings).
 */
export function isYearMonthRange(value: string): boolean {
  const parts = value.split(":");
  return parts.length === 2 && parts.every(isYearMonth) && parts[0] <= parts[1];
}

/** Parse `?period=` — YYYY-MM, preset key, `YYYY-MM:YYYY-MM` range, or default to current month. */
export function parsePeriodParam(param: string | undefined, now: Date = new Date()): Period {
  if (!param) return { type: "month", month: currentMonth(now) };
  if (isYearMonth(param)) return { type: "month", month: param };
  if (isPeriodPreset(param)) {
    if (param === "1m") return { type: "month", month: currentMonth(now) };
    return { type: "preset", value: param };
  }
  if (isYearMonthRange(param)) {
    const [from, to] = param.split(":");
    return { type: "range", from, to };
  }
  return { type: "month", month: currentMonth(now) };
}

export function periodToParam(period: Period): string {
  if (period.type === "month") return period.month;
  if (period.type === "range") return `${period.from}:${period.to}`;
  return period.value;
}

/** Number of calendar months spanned from `from` to `to`, inclusive (e.g. 2026-03 → 2026-06 is 4). */
function monthSpan(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/** Last day of `yyyyMM` (e.g. "2026-02" → "2026-02-28"). Shared by periodBounds' `month`/`range` branches. */
function monthEnd(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${yyyyMM}-${String(lastDay).padStart(2, "0")}`;
}

export function addMonths(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function toMonthLabel(yyyyMM: string): string {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

/**
 * Inclusive date window for charts and transaction lists.
 * `to` is capped at today for ongoing periods.
 */
export function periodBounds(
  period: Period,
  opts: { earliestDate?: string | null; now?: Date } = {},
): { from: string; to: string; monthCount: number | null } {
  const now = opts.now ?? new Date();
  const to = todayISO(now);

  if (period.type === "month") {
    const from = `${period.month}-01`;
    const end = monthEnd(period.month);
    return { from, to: end < to ? end : to, monthCount: 1 };
  }

  if (period.type === "range") {
    const from = `${period.from}-01`;
    const end = monthEnd(period.to);
    return { from, to: end < to ? end : to, monthCount: monthSpan(period.from, period.to) };
  }

  const months = PRESET_MONTHS[period.value];
  if (months === null) {
    const from = opts.earliestDate?.slice(0, 10) ?? to;
    return { from: from < to ? from : to, to, monthCount: null };
  }

  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const from = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`;
  return { from, to, monthCount: months };
}

/**
 * Human label for a `Period` — "ce mois" / a preset's own label / an
 * explicit "mars 2026" for an arbitrary `?period=YYYY-MM`. Shared by
 * /dashboard and /analytics (plan §Étape 3 dashboard, generalized §Étape 4)
 * — both computed this identically inline before being extracted here.
 */
function singleMonthLabel(month: string, now: Date): string {
  return month === currentMonth(now) ? "ce mois" : toMonthLabel(month);
}

export function periodLabel(period: Period, now: Date = new Date()): string {
  if (period.type === "preset") return PERIOD_PRESET_LABELS[period.value].toLowerCase();
  if (period.type === "range") {
    if (period.from === period.to) return singleMonthLabel(period.from, now);
    return `${toMonthLabel(period.from)} – ${toMonthLabel(period.to)}`;
  }
  return singleMonthLabel(period.month, now);
}

/**
 * Widens a `periodBounds()` window up to `minMonths` when it's narrower —
 * a trend chart (bar/line series bucketed by month) showing a single bar
 * for "ce mois" defeats the point of a trend view. Never *shrinks* a wider
 * selection (including "tout", `monthCount: null`, which is already
 * maximal). Shared by the dashboard's income/expense trend and every
 * /analytics widget (plan §Étape 3 dashboard trend, generalized §Étape 4).
 *
 * `endMonth` (defaults to `now`'s month) anchors the widened window — every
 * period type *except* `range` already ends at "now"/today, so the default
 * was correct for all of them, but a past `range` (e.g. mars–mai while
 * today is septembre) must widen backwards from its own `to`, not from
 * today, or the extra months tacked on belong to the wrong window entirely.
 */
export function floorMonthWindow(
  periodFrom: string,
  periodMonthCount: number | null,
  minMonths: number,
  now: Date = new Date(),
  endMonth: string = currentMonth(now),
): { from: string; monthCount: number | null; isFloored: boolean } {
  if (periodMonthCount === null || periodMonthCount >= minMonths) {
    return { from: periodFrom, monthCount: periodMonthCount, isFloored: false };
  }
  return {
    from: `${addMonths(endMonth, -(minMonths - 1))}-01`,
    monthCount: minMonths,
    isFloored: true,
  };
}
