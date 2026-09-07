"use client";

import { useLocale } from "@/components/locale-provider";

/**
 * FR/EN switch — same visual language as `ThemeToggle` (a bordered icon-ish
 * button in the app header), placed right next to it in
 * app/(app)/layout.tsx. A single click swaps to the other locale; the
 * active one is bold, matching the "pill" active/inactive pattern used by
 * PeriodSelector/AccountSelector elsewhere on the dashboard.
 */
export function LocaleToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="inline-flex items-center rounded-md border border-zinc-300 text-xs dark:border-zinc-600">
      <button
        type="button"
        onClick={() => setLocale("fr")}
        aria-pressed={locale === "fr"}
        className={`rounded-l-md px-2 py-1.5 ${
          locale === "fr"
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-r-md px-2 py-1.5 ${
          locale === "en"
            ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        }`}
      >
        EN
      </button>
    </div>
  );
}
