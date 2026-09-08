"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { LogoutButtonLabel } from "@/components/layout/logout-button-label";
import { LocaleToggle } from "@/components/locale-toggle";
import { useLocale } from "@/components/locale-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { NAV_ITEMS } from "@/lib/constants";
import { NAV_ACCENTS, NAV_ICONS, navPillClass } from "@/lib/nav-icons";

/**
 * Sticky top navbar (issue #42) — replaces the old `Sidebar`
 * (side column on desktop / band on mobile) with a single horizontal bar
 * that stays at the top on every breakpoint, styled "colorful/expressive"
 * SaaS-2026 (translucent + blurred background, pill nav items, active item
 * filled with a categorical chart color — see lib/nav-icons.tsx).
 *
 * Two rows inside one sticky `<header>` (title/account row, then a
 * horizontally-scrolling pill row) so it always reads as one cohesive bar
 * instead of the old two-stacked-blocks layout, while still keeping the
 * account controls reachable without crowding the nav pills on narrow
 * screens.
 *
 * Stays a Client Component for `usePathname` (active-item highlighting)
 * and the toggles' own client state. The logout `<form action={logout}>`
 * still calls the Server Action directly — Next.js allows a Server Action
 * reference to be imported and used as a form's `action` from inside a
 * Client Component, so no extra client/server split is needed just for
 * that button.
 */
export function TopNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/80 shadow-sm backdrop-blur-md dark:border-zinc-800/80 dark:bg-zinc-900/80">
      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <Link
          href="/dashboard"
          className="shrink-0 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          {t("nav.appTitle")}
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <p className="hidden max-w-[14rem] truncate text-sm text-zinc-600 sm:block dark:text-zinc-400">
            {userEmail}
          </p>
          <LocaleToggle />
          <ThemeToggle />
          <form action={logout}>
            <Button type="submit" variant="outline" size="sm" className="rounded-full">
              <LogoutButtonLabel />
            </Button>
          </form>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto px-4 py-3">
        {NAV_ITEMS.map((item) => {
          // Same prefix-match rule as the old Sidebar (issue #37): a
          // sub-route like /transactions/123 still highlights its parent.
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = NAV_ICONS[item.key];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 ${navPillClass(active)}`}
              style={active ? { backgroundColor: NAV_ACCENTS[item.key] } : undefined}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(`nav.items.${item.key}`)}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
