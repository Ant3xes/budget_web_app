"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLocale } from "@/components/locale-provider";
import { NAV_ACCENTS, navPillClass } from "@/lib/nav-icons";

const SETTINGS_NAV = [
  { href: "/settings/categories", key: "categories" },
  { href: "/settings/import-rules", key: "importRules" },
  { href: "/settings/profile", key: "profile" },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <section className="flex flex-col gap-6 p-6 md:flex-row">
      <nav className="flex gap-2 md:w-48 md:flex-col md:gap-1">
        <h2 className="hidden text-xs font-semibold uppercase tracking-wide text-zinc-500 md:block mb-2 dark:text-zinc-400">
          {t("nav.settingsNav.title")}
        </h2>
        {SETTINGS_NAV.map((item) => {
          // Same prefix-match fix as the main TopNav (issue #37) — none of
          // these 3 items has a sub-route today, so this is a no-op change
          // in current behavior, just closing off the same exact-match
          // landmine before a future settings sub-route (e.g. an import
          // rule's own detail page) resurrects it here too.
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              // Same pill/accent language as the top navbar (issue #42) —
              // shares `navPillClass`/`NAV_ACCENTS` with top-nav.tsx (rather
              // than each hand-typing the same class string and color) so
              // this pill can't silently drift out of sync with the top
              // navbar's own "Paramètres" pill.
              className={navPillClass(active)}
              style={active ? { backgroundColor: NAV_ACCENTS.settings } : undefined}
            >
              {t(`nav.settingsNav.${item.key}`)}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1">{children}</div>
    </section>
  );
}
