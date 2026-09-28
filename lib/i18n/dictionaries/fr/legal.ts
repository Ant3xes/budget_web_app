/**
 * Bannière cookies + mentions légales sous les formulaires login/signup.
 * Le contenu des pages elles-mêmes (`app/(legal)/rgpd`, `app/(legal)/cgu`)
 * n'est pas dans ce dictionnaire : ce sont des pages statiques en français
 * uniquement (même choix que `app/plan/page.tsx`), pas de version EN.
 */
export const legal = {
  cookieBanner: {
    text: "Ce site utilise un cookie de session strictement nécessaire à l'authentification (Supabase Auth). Aucun cookie de mesure d'audience ou publicitaire n'est utilisé.",
    dismiss: "Compris",
  },
  consentNotice: {
    text: "En continuant, vous acceptez les {cgu} et la {rgpd}.",
    cgu: "CGU",
    rgpd: "politique de confidentialité",
  },
} as const;
