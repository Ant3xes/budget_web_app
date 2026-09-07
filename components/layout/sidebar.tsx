"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLocale } from "@/components/locale-provider";
import { NAV_ITEMS } from "@/lib/constants";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();

  return (
    <aside className="w-full border-b border-zinc-200 bg-white p-4 md:w-64 md:border-b-0 md:border-r md:min-h-screen dark:border-zinc-700 dark:bg-zinc-900">
      <h1 className="mb-4 text-lg font-semibold dark:text-zinc-100">{t("nav.appTitle")}</h1>
      <nav className="flex gap-2 overflow-x-auto md:flex-col">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm ${
                active
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {t(`nav.items.${item.key}`)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
