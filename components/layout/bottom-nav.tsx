"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { MoreSheet } from "@/components/layout/more-sheet";
import { isNavActive, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from "@/components/layout/nav-utils";
import { useLocale } from "@/components/locale-provider";
import { NAV_ICONS } from "@/lib/nav-icons";

/** Bouton rond de la pilule flottante : l'actif est rempli, les autres restent discrets. */
function pillItemClass(active: boolean): string {
  return `flex size-12 items-center justify-center rounded-full transition-colors ${
    active ? "bg-muted text-foreground" : "text-muted-foreground active:bg-muted/60"
  }`;
}

/**
 * Navigation mobile (< md) : barre du haut minimale (logo) + pilule flottante
 * en bas (façon Supabase) à 4 icônes + « Plus » (sheet avec le reste, les
 * toggles et la déconnexion). Respecte la safe-area iOS (`viewport-fit=cover`).
 */
export function BottomNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [moreOpen, setMoreOpen] = useState(false);

  const moreActive = SECONDARY_NAV_ITEMS.some((item) => isNavActive(pathname, item.href));

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-40 flex items-center border-b border-border bg-background/80 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <Link href="/dashboard" className="flex h-14 items-center text-foreground">
          <Logo title={t("nav.appTitle")} />
        </Link>
      </header>

      <nav
        aria-label={t("nav.mainNav")}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <ul className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-card/85 p-1.5 shadow-lg ring-1 ring-foreground/5 backdrop-blur-md">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = NAV_ICONS[item.key];
            const label = t(`nav.items.${item.key}`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={label}
                  title={label}
                  className={pillItemClass(active)}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-label={t("nav.more")}
              title={t("nav.more")}
              className={pillItemClass(moreActive)}
            >
              <MoreHorizontal className="size-5" strokeWidth={moreActive ? 2.25 : 1.75} aria-hidden="true" />
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} userEmail={userEmail} />
    </div>
  );
}
