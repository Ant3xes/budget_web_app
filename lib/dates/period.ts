export type PeriodPreset = "1m" | "3m" | "6m" | "1a" | "2a" | "tout";

export type Period =
  | { type: "preset"; value: PeriodPreset }
  | { type: "month"; month: string }; // YYYY-MM

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
  return /^\d{4}-\d{2}$/.test(value);
}

/** Parse `?period=` — YYYY-MM, preset key, or default to current month. */
export function parsePeriodParam(param: string | undefined, now: Date = new Date()): Period {
  if (!param) return { type: "month", month: currentMonth(now) };
  if (isYearMonth(param)) return { type: "month", month: param };
  if (isPeriodPreset(param)) {
    if (param === "1m") return { type: "month", month: currentMonth(now) };
    return { type: "preset", value: param };
  }
  return { type: "month", month: currentMonth(now) };
}

export function periodToParam(period: Period): string {
  if (period.type === "month") return period.month;
  return period.value;
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
    const [y, m] = period.month.split("-").map(Number);
    const from = `${period.month}-01`;
    const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const monthEnd = `${period.month}-${String(lastDay).padStart(2, "0")}`;
    return { from, to: monthEnd < to ? monthEnd : to, monthCount: 1 };
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
export function periodLabel(period: Period, now: Date = new Date()): string {
  if (period.type === "preset") return PERIOD_PRESET_LABELS[period.value].toLowerCase();
  return period.month === currentMonth(now) ? "ce mois" : toMonthLabel(period.month);
}

/**
 * Widens a `periodBounds()` window up to `minMonths` when it's narrower —
 * a trend chart (bar/line series bucketed by month) showing a single bar
 * for "ce mois" defeats the point of a trend view. Never *shrinks* a wider
 * selection (including "tout", `monthCount: null`, which is already
 * maximal). Shared by the dashboard's income/expense trend and every
 * /analytics widget (plan §Étape 3 dashboard trend, generalized §Étape 4).
 */
export function floorMonthWindow(
  periodFrom: string,
  periodMonthCount: number | null,
  minMonths: number,
  now: Date = new Date(),
): { from: string; monthCount: number | null; isFloored: boolean } {
  if (periodMonthCount === null || periodMonthCount >= minMonths) {
    return { from: periodFrom, monthCount: periodMonthCount, isFloored: false };
  }
  return {
    from: `${addMonths(currentMonth(now), -(minMonths - 1))}-01`,
    monthCount: minMonths,
    isFloored: true,
  };
}
