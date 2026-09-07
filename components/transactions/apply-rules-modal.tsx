"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { resolveCategoryName } from "@/lib/i18n/category-name";

type PreviewItem = {
  id: string;
  description: string;
  kind: "expense" | "income";
  suggested_category_id: string;
  suggestion_source: "rule" | "history";
  category_name: string;
  category_icon: string | null;
};

type UnmatchedItem = { id: string; description: string; kind: "expense" | "income" };

// Must match the `keyword` max length in the POST /api/transactions/apply-rules
// zod schema (app/api/transactions/apply-rules/route.ts) — the keyword
// defaults to the raw transaction description, which can exceed it.
const RULE_KEYWORD_MAX_LENGTH = 200;

type GroupedCategory = {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  items: PreviewItem[];
};

type Category = {
  id: string;
  name: string;
  kind: string;
  icon: string | null;
  is_default?: boolean;
  translation_key?: string | null;
};

interface ApplyRulesModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

export function ApplyRulesModal({ onSuccess, onClose }: ApplyRulesModalProps) {
  const { t } = useLocale();
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ applied: number; rulesCreated: number } | null>(null);

  // Per unmatched-row manual assignment: chosen category, whether to save a
  // rule from it, and the (editable) keyword the rule will match on.
  const [manualCategory, setManualCategory] = useState<Record<string, string>>({});
  const [createRule, setCreateRule] = useState<Record<string, boolean>>({});
  const [keyword, setKeyword] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const [rulesRes, catRes] = await Promise.all([
        fetch("/api/transactions/apply-rules"),
        fetch("/api/categories"),
      ]);
      setIsLoading(false);
      if (!rulesRes.ok) {
        const data = (await rulesRes.json()) as { error?: string };
        setError(data.error ?? t("transactions.applyRules.loadError"));
        return;
      }
      // The API also returns `unmatched_count` (the true total, since
      // `unmatched` itself is capped) — not consumed yet, kept server-side
      // for a future "showing 500 of N" hint if the list ever gets that big.
      const data = (await rulesRes.json()) as {
        previews: PreviewItem[];
        unmatched: UnmatchedItem[];
      };
      setPreviews(data.previews);
      setUnmatched(data.unmatched ?? []);
      const initKeyword: Record<string, string> = {};
      const initCreateRule: Record<string, boolean> = {};
      for (const u of data.unmatched ?? []) {
        initKeyword[u.id] = u.description;
        initCreateRule[u.id] = true;
      }
      setKeyword(initKeyword);
      setCreateRule(initCreateRule);

      if (catRes.ok) {
        const catData = (await catRes.json()) as { categories: Category[] };
        setCategories(catData.categories ?? []);
      }
    };
    void load();
    // Fetch once on mount; `t` only labels a rare error response, and
    // depending on it would refetch (discarding the user's in-progress
    // manual picks) on a locale switch while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApply = async () => {
    const manualEntries = unmatched.filter((u) => manualCategory[u.id]);
    if (previews.length === 0 && manualEntries.length === 0) return;
    setError(null);
    setIsSubmitting(true);

    const updates = [
      ...previews.map((p) => ({ id: p.id, category_id: p.suggested_category_id })),
      ...manualEntries.map((u) => ({ id: u.id, category_id: manualCategory[u.id]! })),
    ];
    const new_rules = manualEntries
      .filter((u) => createRule[u.id] && (keyword[u.id] ?? "").trim().length > 0)
      .map((u) => ({
        keyword: keyword[u.id]!.trim().slice(0, RULE_KEYWORD_MAX_LENGTH),
        category_id: manualCategory[u.id]!,
        kind: u.kind,
      }));

    const res = await fetch("/api/transactions/apply-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates, new_rules }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? t("transactions.applyRules.applyError"));
      return;
    }

    const data = (await res.json()) as { applied: number; rules_created: number };
    setResult({ applied: data.applied, rulesCreated: data.rules_created });
  };

  // Group auto-matched previews by category
  const grouped: GroupedCategory[] = [];
  for (const item of previews) {
    const existing = grouped.find((g) => g.category_id === item.suggested_category_id);
    if (existing) {
      existing.items.push(item);
    } else {
      grouped.push({
        category_id: item.suggested_category_id,
        category_name: item.category_name,
        category_icon: item.category_icon,
        items: [item],
      });
    }
  }
  grouped.sort((a, b) => b.items.length - a.items.length);

  const manualChosenCount = unmatched.filter((u) => manualCategory[u.id]).length;
  const totalActionable = previews.length + manualChosenCount;

  // Grouped once per `categories` change instead of re-filtering the full
  // list for every unmatched row on every render.
  const categoriesByKind = useMemo(() => {
    const byKind: Record<"expense" | "income", Category[]> = { expense: [], income: [] };
    for (const c of categories) {
      if (c.kind === "expense" || c.kind === "income") byKind[c.kind].push(c);
    }
    return byKind;
  }, [categories]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl flex flex-col max-h-[85vh] dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold">{t("transactions.applyRules.title")}</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700 text-xl leading-none dark:text-zinc-500 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <p className="text-sm text-zinc-500">{t("common.state.loading")}</p>
          ) : result !== null ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              <p className="text-lg font-semibold">{t("transactions.applyRules.appliedTitle")}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("transactions.applyRules.appliedDescription", {
                  count: result.applied,
                  plural: result.applied > 1 ? "s" : "",
                })}
              </p>
              {result.rulesCreated > 0 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t("transactions.applyRules.rulesCreatedDescription", {
                    count: result.rulesCreated,
                    plural: result.rulesCreated > 1 ? "s" : "",
                  })}
                </p>
              )}
            </div>
          ) : previews.length === 0 && unmatched.length === 0 ? (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("transactions.applyRules.nothingToCategorize")}</p>
          ) : (
            <div className="space-y-6">
              {previews.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{previews.length}</span>{" "}
                    {t("transactions.applyRules.willApplyCount")}
                  </p>
                  <div className="space-y-2">
                    {grouped.map((group) => (
                      <div key={group.category_id} className="rounded-lg border border-zinc-200 dark:border-zinc-700">
                        <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 rounded-t-lg">
                          <span className="text-sm font-medium">
                            {group.category_icon ? `${group.category_icon} ` : ""}
                            {group.category_name}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {t("transactions.applyRules.transactionCount", {
                              count: group.items.length,
                              plural: group.items.length > 1 ? "s" : "",
                            })}
                          </span>
                        </div>
                        <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {group.items.map((item) => (
                            <li key={item.id} className="flex items-center justify-between px-4 py-2 text-xs">
                              <span className="text-zinc-700 dark:text-zinc-300 truncate max-w-[280px]">
                                {item.description}
                              </span>
                              <span
                                className={`ml-2 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] leading-none ${
                                  item.suggestion_source === "rule"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                                }`}
                              >
                                {item.suggestion_source === "rule"
                                  ? t("transactions.applyRules.sourceRule")
                                  : t("transactions.applyRules.sourceHistory")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {unmatched.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {t("transactions.applyRules.unmatchedTitle", {
                      count: unmatched.length,
                      plural: unmatched.length > 1 ? "s" : "",
                    })}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">{t("transactions.applyRules.unmatchedHint")}</p>
                  <ul className="space-y-2">
                    {unmatched.map((u) => {
                      const kindCategories = categoriesByKind[u.kind];
                      const chosen = manualCategory[u.id] ?? "";
                      return (
                        <li key={u.id} className="rounded-lg border border-zinc-200 p-3 text-xs dark:border-zinc-700">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate max-w-[220px] text-zinc-700 dark:text-zinc-300" title={u.description}>
                              {u.description}
                            </span>
                            <select
                              value={chosen}
                              onChange={(e) =>
                                setManualCategory((prev) => ({ ...prev, [u.id]: e.target.value }))
                              }
                              className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                              <option value="">{t("transactions.applyRules.chooseCategoryOption")}</option>
                              {kindCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.icon ? `${c.icon} ` : ""}
                                  {resolveCategoryName(c, t)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {chosen && (
                            <div className="mt-2 flex items-center gap-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                              <label className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
                                <input
                                  type="checkbox"
                                  checked={createRule[u.id] ?? true}
                                  onChange={(e) =>
                                    setCreateRule((prev) => ({ ...prev, [u.id]: e.target.checked }))
                                  }
                                />
                                {t("transactions.applyRules.createRuleLabel")}
                              </label>
                              {(createRule[u.id] ?? true) && (
                                <input
                                  type="text"
                                  value={keyword[u.id] ?? u.description}
                                  onChange={(e) => setKeyword((prev) => ({ ...prev, [u.id]: e.target.value }))}
                                  placeholder={t("transactions.applyRules.keywordPlaceholder")}
                                  maxLength={RULE_KEYWORD_MAX_LENGTH}
                                  className="flex-1 rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                                />
                              )}
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
          {result !== null ? (
            <button
              onClick={onSuccess}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
            >
              {t("common.actions.close")}
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-300"
              >
                {t("common.actions.cancel")}
              </button>
              {totalActionable > 0 && (
                <button
                  onClick={() => void handleApply()}
                  disabled={isSubmitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                >
                  {isSubmitting
                    ? t("transactions.applyRules.applying")
                    : t("transactions.applyRules.applyButton", {
                        count: totalActionable,
                        plural: totalActionable > 1 ? "s" : "",
                      })}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
