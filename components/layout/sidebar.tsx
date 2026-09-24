"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { Logo } from "@/components/brand/logo";
import { LogoutButtonLabel } from "@/components/layout/logout-button-label";
import { isNavActive } from "@/components/layout/nav-utils";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocale } from "@/components/locale-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/constants";
import { NAV_ACCENTS, NAV_ICONS, navPillClass } from "@/lib/nav-icons";

/**
 * Sidebar desktop (≥ md) : logo en haut, les 9 entrées en pills (l'active est
 * remplie de sa couleur d'accent), compte + toggles + déconnexion en bas.
 * Sous `md`, c'est `BottomNav` qui prend le relais.
 */
export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-md md:flex">
      <Link href="/dashboard" className="px-5 pt-5 pb-4 text-foreground">
        <Logo title={t("nav.appTitle")} />
      </Link>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = NAV_ICONS[item.key];
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2.5 ${navPillClass(active)}`}
              style={active ? { backgroundColor: NAV_ACCENTS[item.key] } : undefined}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(`nav.items.${item.key}`)}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-3 border-t border-border p-4">
        <p className="truncate text-xs text-muted-foreground" title={userEmail}>
          {userEmail}
        </p>
        <div className="flex items-center gap-2">
          <LocaleToggle />
          <ThemeToggle />
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline" size="sm" className="w-full rounded-full">
            <LogoutButtonLabel />
          </Button>
        </form>
      </div>
    </aside>
  );
}
