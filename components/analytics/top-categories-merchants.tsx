"use client";

import type { ReactNode } from "react";

import { useLocale } from "@/components/locale-provider";
import { ChartEmptyState } from "@/components/chart-empty-state";
import { resolveCategoryName } from "@/lib/i18n/category-name";
import { formatEuros } from "@/lib/format";

export interface TopCategoryRow {
  name: string; // raw/untranslated — resolved via resolveCategoryName below
  value: number; // cents
  icon: string | null;
  color: string;
  isDefault?: boolean;
  translationKey?: string | null;
}

export interface TopMerchantRow {
  description: string;
  count: number;
  total: number; // cents
}

interface TopCategoriesMerchantsProps {
  topCategories: TopCategoryRow[];
  topMerchants: TopMerchantRow[];
}

function RankedList({ title, empty, children, maxValue }: { title: string; empty: string; children: ReactNode; maxValue: number }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      {maxValue === 0 ? <p className="text-sm text-zinc-500">{empty}</p> : <ul className="space-y-2">{children}</ul>}
    </div>
  );
}

/**
 * "Top catégories & marchands récurrents" (issue #36) — a ranked-list form
 * rather than a chart (dataviz skill's form heuristic: a top-N ranking with
 * a name label per row reads better as small horizontal bars than as a
 * pie/donut, which the "Répartition" tab already covers). Both lists are
 * pre-sorted and pre-limited to top 5 server-side (see page.tsx) — this
 * component just renders them, no client-side sorting.
 */
export function TopCategoriesMerchants({ topCategories, topMerchants }: TopCategoriesMerchantsProps) {
  const { t } = useLocale();
  const resolvedCategories = topCategories.map((c) => ({
    ...c,
    name: resolveCategoryName({ name: c.name, is_default: c.isDefault, translation_key: c.translationKey }, t),
  }));
  const maxCategory = Math.max(0, ...resolvedCategories.map((c) => c.value));
  const maxMerchant = Math.max(0, ...topMerchants.map((m) => m.total));

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <RankedList title={t("analytics.topCategories.categoriesHeading")} empty={t("analytics.topCategories.empty")} maxValue={maxCategory}>
        {resolvedCategories.map((c) => (
          <li key={c.name} className="text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-zinc-700 dark:text-zinc-300">
                {c.icon && <span className="mr-1">{c.icon}</span>}
                {c.name}
              </span>
              <span className="shrink-0 font-medium text-zinc-800 dark:text-zinc-100">{formatEuros(c.value)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-1.5 rounded-full"
                style={{ width: `${maxCategory > 0 ? (c.value / maxCategory) * 100 : 0}%`, backgroundColor: c.color }}
              />
            </div>
          </li>
        ))}
      </RankedList>

      <RankedList title={t("analytics.topCategories.merchantsHeading")} empty={t("analytics.topCategories.empty")} maxValue={maxMerchant}>
        {topMerchants.map((m) => (
          <li key={m.description} className="text-sm">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-zinc-700 dark:text-zinc-300">
                {m.description}
                <span className="ml-1.5 text-xs text-zinc-400">
                  {t("analytics.topCategories.occurrences", { count: m.count, plural: m.count > 1 ? "s" : "" })}
                </span>
              </span>
              <span className="shrink-0 font-medium text-zinc-800 dark:text-zinc-100">{formatEuros(m.total)}</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-1.5 rounded-full bg-[var(--chart-1)]"
                style={{ width: `${maxMerchant > 0 ? (m.total / maxMerchant) * 100 : 0}%` }}
              />
            </div>
          </li>
        ))}
      </RankedList>

      {topCategories.length === 0 && topMerchants.length === 0 && <ChartEmptyState className="col-span-2" />}
    </div>
  );
}
