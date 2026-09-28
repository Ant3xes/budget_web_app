"use client";

import Link from "next/link";

import { useLocale } from "@/components/locale-provider";

/**
 * Mention "En vous inscrivant/continuant, vous acceptez les CGU et la
 * politique de confidentialité" sous les formulaires login/signup. Un
 * composant client dédié (plutôt qu'un `<T>` inline) car il a besoin de
 * `<Link>` au milieu du texte, pas juste d'une chaîne — `t()` fait
 * l'interpolation `{cgu}`/`{rgpd}` comme des chaînes brutes, donc le texte
 * est découpé ici sur ces deux tokens pour y glisser de vrais liens.
 */
export function LegalConsentNotice() {
  const { t } = useLocale();
  const template = t("legal.consentNotice.text");
  const [beforeCgu, rest] = template.split("{cgu}");
  const [betweenCguRgpd, afterRgpd] = (rest ?? "").split("{rgpd}");

  return (
    <p className="mt-4 text-xs text-muted-foreground">
      {beforeCgu}
      <Link href="/legal/cgu" className="underline underline-offset-2 hover:text-foreground">
        {t("legal.consentNotice.cgu")}
      </Link>
      {betweenCguRgpd}
      <Link href="/legal/rgpd" className="underline underline-offset-2 hover:text-foreground">
        {t("legal.consentNotice.rgpd")}
      </Link>
      {afterRgpd}
    </p>
  );
}
