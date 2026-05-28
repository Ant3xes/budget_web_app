"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const SETTINGS_NAV = [
  { href: "/settings/categories", label: "Catégories" },
  { href: "/settings/import-rules", label: "Règles d'import" },
  { href: "/settings/profile", label: "Profil" },
] as const;

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <section className="flex flex-col gap-6 p-6 md:flex-row">
      <nav className="flex gap-2 md:w-48 md:flex-col md:gap-1">
        <h2 className="hidden text-xs font-semibold uppercase tracking-wide text-zinc-500 md:block mb-2 dark:text-zinc-400">Paramètres</h2>
        {SETTINGS_NAV.map((item) => {
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
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1">{children}</div>
    </section>
  );
}
