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
 *
 * Toast compact (pas une barre pleine largeur) : l'espace authentifié a déjà
 * deux éléments fixes en bas d'écran — la pilule de navigation mobile
 * (`BottomNav`, `bottom-0 z-40`) et le menu utilisateur en bas de la sidebar
 * desktop (`Sidebar`) — qu'une barre `inset-x-0 bottom-0` recouvrait et dont
 * elle bloquait les clics (CI : auth/dashboard/mobile.spec.ts en timeout sur
 * un clic intercepté par cette bannière). Ancré à droite sur desktop (la
 * sidebar fait au plus `w-60`, jamais de recouvrement) et remonté au-dessus
 * de la pilule sur mobile.
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
      className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm flex-col items-start gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg md:inset-x-auto md:right-6 md:mx-0 md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      <p className="text-sm text-muted-foreground">{t("legal.cookieBanner.text")}</p>
      <button
        type="button"
        onClick={dismiss}
        className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        {t("legal.cookieBanner.dismiss")}
      </button>
    </div>
  );
}
