"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";

export type Locale = "fr" | "en";

const DICTIONARIES = { fr, en } satisfies Record<Locale, unknown>;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /**
   * Looks up `key` (a dot-path, e.g. "dashboard.title") in the current
   * locale's dictionary, interpolating `{var}` placeholders from `vars`.
   * A missing key returns the key itself — visibly wrong rather than a
   * silent crash or a blank string, matching `useTheme()`'s own fail-loud
   * philosophy for a bad `theme` value.
   */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function lookup(dict: unknown, key: string): unknown {
  return key.split(".").reduce<unknown>((node, segment) => {
    if (node && typeof node === "object" && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, dict);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

/**
 * Locale (FR/EN) preference — same shape as `ThemeProvider`
 * (components/theme-provider.tsx): `localStorage`-only persistence (no DB
 * column, per plan), read post-hydration to avoid an SSR mismatch, default
 * "fr" when nothing is stored (the app's default locale).
 */
export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    const stored = localStorage.getItem("locale") as Locale | null;
    const initial = stored && ["fr", "en"].includes(stored) ? stored : "fr";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage post-hydration to avoid SSR mismatch
    setLocaleState(initial);
  }, []);

  // Memoized on `locale` alone (the only thing that should ever change this
  // value): LocaleProvider wraps the whole app, so an unmemoized context
  // value would force every one of the many `useLocale()` consumers to
  // re-render on any LocaleProvider re-render, not just an actual locale
  // change.
  const value = useMemo<LocaleContextValue>(() => {
    function setLocale(next: Locale) {
      setLocaleState(next);
      if (next === "fr") {
        // "fr" is the default: dropping the key (rather than writing "fr")
        // mirrors ThemeProvider's `removeItem` on its own default ("system").
        localStorage.removeItem("locale");
      } else {
        localStorage.setItem("locale", next);
      }
    }

    function t(key: string, vars?: Record<string, string | number>): string {
      const value = lookup(DICTIONARIES[locale], key);
      if (typeof value !== "string") return key;
      return interpolate(value, vars);
    }

    return { locale, setLocale, t };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used inside <LocaleProvider>");
  return ctx;
}
