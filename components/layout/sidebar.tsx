"use client";

import { ChevronsUpDown, PanelLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { logout } from "@/app/(auth)/actions";
import { Logo, LogoMark } from "@/components/brand/logo";
import { LogoutButtonLabel } from "@/components/layout/logout-button-label";
import { isNavActive, SIDEBAR_COOKIE } from "@/components/layout/nav-utils";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocale } from "@/components/locale-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NAV_ITEMS } from "@/lib/constants";
import { NAV_ICONS } from "@/lib/nav-icons";
import { cn } from "@/lib/utils";

/**
 * Sidebar desktop (≥ md), façon Supabase : rail d'icônes (w-14) ou menu déplié
 * (w-60), bascule par le bouton en bas. L'état est persisté dans un cookie lu
 * côté serveur par le layout (`defaultCollapsed`) — pas de flash au chargement.
 * Compte + préférences + déconnexion vivent dans un menu déroulant en bas.
 * Sous `md`, c'est `BottomNav` qui prend le relais.
 */
export function Sidebar({ userEmail, defaultCollapsed }: { userEmail: string; defaultCollapsed: boolean }) {
  const pathname = usePathname();
  const { t } = useLocale();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  };

  const initial = (userEmail.trim()[0] ?? "?").toUpperCase();

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card/60 backdrop-blur-md transition-[width] duration-200 md:flex",
        collapsed ? "w-14" : "w-60",
      )}
    >
      <Link
        href="/dashboard"
        aria-label={t("nav.appTitle")}
        className={cn("flex h-14 items-center border-b border-border text-foreground", collapsed ? "justify-center" : "px-4")}
      >
        {collapsed ? <LogoMark className="size-7" /> : <Logo title={t("nav.appTitle")} />}
      </Link>

      <nav aria-label={t("nav.mainNav")} className="flex flex-1 flex-col gap-0.5 p-2">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = NAV_ICONS[item.key];
          const label = t(`nav.items.${item.key}`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={collapsed ? label : undefined}
              className={cn(
                "group/item relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2.25 : 1.75} aria-hidden="true" />
              {!collapsed && <span className="truncate">{label}</span>}
              {collapsed && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-md bg-popover px-2 py-1 text-xs font-medium whitespace-nowrap text-popover-foreground opacity-0 shadow-md ring-1 ring-foreground/10 transition-opacity group-hover/item:opacity-100 group-focus-visible/item:opacity-100"
                >
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className={cn("flex border-t border-border p-2", collapsed ? "flex-col items-center gap-1" : "items-center gap-1")}>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={userEmail}
            title={userEmail}
            className={cn(
              "flex h-9 items-center gap-2 rounded-lg text-sm text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
              collapsed ? "w-9 justify-center" : "min-w-0 flex-1 px-1.5",
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
              {initial}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate text-left">{userEmail}</span>
                <ChevronsUpDown className="size-3.5 shrink-0" aria-hidden="true" />
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-56 p-3">
            <p className="mb-3 truncate text-xs text-muted-foreground" title={userEmail}>
              {userEmail}
            </p>
            <div className="mb-3 flex items-center gap-2">
              <LocaleToggle />
              <ThemeToggle />
            </div>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm" className="w-full rounded-full">
                <LogoutButtonLabel />
              </Button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? t("nav.expand") : t("nav.collapse")}
          title={collapsed ? t("nav.expand") : t("nav.collapse")}
          aria-expanded={!collapsed}
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <PanelLeft className="size-[18px]" aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}
