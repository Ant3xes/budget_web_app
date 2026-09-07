"use client";

import { useLocale } from "@/components/locale-provider";

/**
 * Inline translated text as a leaf Client Component — lets a Server
 * Component (e.g. app/(app)/dashboard/page.tsx, which can't call
 * `useLocale()` itself since it's async and does top-level data fetching)
 * render a single translated string without being converted to a Client
 * Component wholesale. Prefer a dedicated widget component that calls
 * `useLocale()` directly when a whole section needs translating (see
 * components/dashboard/*.tsx) — reach for `<T>` only for a one-off string
 * still living directly in a Server Component's JSX.
 */
export function T({ k, vars }: { k: string; vars?: Record<string, string | number> }) {
  const { t } = useLocale();
  return <>{t(k, vars)}</>;
}
