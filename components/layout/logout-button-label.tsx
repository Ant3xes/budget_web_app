"use client";

import { useLocale } from "@/components/locale-provider";

/**
 * Just the translated text for the logout button in app/(app)/layout.tsx —
 * that layout is an async Server Component (fetches the current user), so
 * it can't call `useLocale()` itself; this is the smallest client boundary
 * that lets the button's label follow the locale without converting the
 * whole layout to a client component.
 */
export function LogoutButtonLabel() {
  const { t } = useLocale();
  return <>{t("nav.logout")}</>;
}
