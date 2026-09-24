"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { MoreSheet } from "@/components/layout/more-sheet";
import { isNavActive, PRIMARY_NAV_ITEMS, SECONDARY_NAV_ITEMS } from "@/components/layout/nav-utils";
import { useLocale } from "@/components/locale-provider";
import { NAV_ACCENTS, NAV_ICONS } from "@/lib/nav-icons";

/**
 * Navigation mobile (< md) : barre du haut minimale (logo) + barre du bas
 * fixe à 4 onglets + « Plus » (sheet avec le reste, les toggles et la
 * déconnexion). Respecte la safe-area iOS (`viewport-fit=cover`).
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
        aria-label="Navigation principale"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-md"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
          {PRIMARY_NAV_ITEMS.map((item) => {
            const active = isNavActive(pathname, item.href);
            const Icon = NAV_ICONS[item.key];
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-16 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors ${
                    active ? "" : "text-muted-foreground"
                  }`}
                  style={active ? { color: NAV_ACCENTS[item.key] } : undefined}
                >
                  <Icon className="size-6" strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                  <span className="max-w-full truncate px-1">{t(`nav.items.${item.key}`)}</span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={`flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-colors ${
                moreActive ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <MoreHorizontal className="size-6" strokeWidth={moreActive ? 2.5 : 2} aria-hidden="true" />
              {t("nav.more")}
            </button>
          </li>
        </ul>
      </nav>

      <MoreSheet open={moreOpen} onOpenChange={setMoreOpen} userEmail={userEmail} />
    </div>
  );
}
