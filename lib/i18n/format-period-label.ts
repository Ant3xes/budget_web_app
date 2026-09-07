import type { Period } from "@/lib/dates/period";
import type { Locale } from "@/components/locale-provider";

/**
 * Client-side, locale-aware counterpart to `lib/dates/period.ts`'s
 * `periodLabel()`/`toMonthLabel()` — those are called from
 * app/(app)/dashboard/page.tsx (a Server Component with no access to the
 * client-only `locale`, per this app's i18n design) and hardcode French
 * output ("ce mois", "mars 2026"), which then got interpolated verbatim
 * into an otherwise-translated heading even in English mode.
 *
 * The dashboard page now passes the raw `period` (already computed
 * server-side) down to each client widget instead of a pre-rendered
 * string, and each widget calls these functions with its own `t`/`locale`
 * from `useLocale()`.
 */

function formatMonthLabel(yyyyMM: string, locale: Locale): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, 1));
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

type TFn = (key: string, vars?: Record<string, string | number>) => string;

/** Mirrors `lib/dates/period.ts`'s `periodLabel()`. `currentMonthValue` is the server-computed "YYYY-MM" for "now", passed down to avoid a client/server clock mismatch. */
export function formatPeriodLabel(period: Period, currentMonthValue: string, locale: Locale, t: TFn): string {
  if (period.type === "preset") return t(`periodSelector.presets.${period.value}`).toLowerCase();
  if (period.type === "range") {
    if (period.from === period.to) {
      return period.from === currentMonthValue
        ? t("periodSelector.presets.1m").toLowerCase()
        : formatMonthLabel(period.from, locale);
    }
    return `${formatMonthLabel(period.from, locale)} – ${formatMonthLabel(period.to, locale)}`;
  }
  return period.month === currentMonthValue
    ? t("periodSelector.presets.1m").toLowerCase()
    : formatMonthLabel(period.month, locale);
}

/** Mirrors `app/(app)/dashboard/page.tsx`'s dedicated "Dépenses par catégorie" label: an explicit month name instead of `formatPeriodLabel`'s "ce mois" wording for the current-month case. */
export function formatCategoryWidgetLabel(period: Period, currentMonthValue: string, locale: Locale, t: TFn): string {
  if (period.type === "month") return formatMonthLabel(period.month, locale);
  return formatPeriodLabel(period, currentMonthValue, locale, t);
}
