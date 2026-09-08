import Link from "next/link";

import { useLocale } from "@/components/locale-provider";

/**
 * "Voir tout" link (issue #35) — extracted after the same markup was
 * hand-copied into 5 dashboard widgets (fixed-charges-summary.tsx,
 * recent-transactions.tsx, savings-goals-summary.tsx, budget-stacked-chart.tsx,
 * category-transactions-overlay.tsx). Always labeled via the shared
 * `common.actions.viewAll` key — no per-widget copy.
 */
export function ViewAllLink({ href, className }: { href: string; className?: string }) {
  const { t } = useLocale();
  return (
    <Link href={href} className={`text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 ${className ?? ""}`}>
      {t("common.actions.viewAll")}
    </Link>
  );
}
