"use client";

import { useEffect, useState } from "react";

import { useLocale } from "@/components/locale-provider";

const CONSENT_KEY = "cookie-consent";

/**
 * Bannière cookies, montée une seule fois dans `app/layout.tsx` (donc visible
 * sur toutes les pages, y compris login/signup/légales). Même idiome que
 * `LocaleProvider`/`ThemeProvider` : lecture de `localStorage` seulement
 * après hydration (`useEffect`) pour éviter un mismatch SSR, pas de cookie
 * ni de champ DB — la session Supabase Auth (seul cookie posé par l'app) est
 * strictement nécessaire, donc il n'y a pas de choix "refuser" à proposer,
 * juste une information + fermeture.
 */
export function CookieBanner() {
  const { t } = useLocale();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read localStorage post-hydration to avoid SSR mismatch
    setDismissed(stored === "1");
  }, []);

  if (dismissed) return null;

  function dismiss() {
    localStorage.setItem(CONSENT_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      role="region"
      aria-label={t("legal.cookieBanner.dismiss")}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-card-foreground shadow-lg md:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">{t("legal.cookieBanner.text")}</p>
        <button
          type="button"
          onClick={dismiss}
          className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t("legal.cookieBanner.dismiss")}
        </button>
      </div>
    </div>
  );
}
