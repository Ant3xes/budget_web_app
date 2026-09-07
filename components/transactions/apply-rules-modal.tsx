"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { useLocale } from "@/components/locale-provider";

type PreviewItem = {
  id: string;
  description: string;
  kind: "expense" | "income";
  suggested_category_id: string;
  suggestion_source: "rule" | "history";
  category_name: string;
  category_icon: string | null;
};

type GroupedCategory = {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  items: PreviewItem[];
};

interface ApplyRulesModalProps {
  kind: "expense" | "income";
  onSuccess: () => void;
  onClose: () => void;
}

export function ApplyRulesModal({ kind, onSuccess, onClose }: ApplyRulesModalProps) {
  const { t } = useLocale();
  const [previews, setPreviews] = useState<PreviewItem[]>([]);
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appliedCount, setAppliedCount] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      const res = await fetch("/api/transactions/apply-rules");
      setIsLoading(false);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? t("transactions.applyRules.loadError"));
        return;
      }
      const data = (await res.json()) as {
        previews: PreviewItem[];
        unmatched_count: number;
      };
      // Filter to the relevant kind
      setPreviews(data.previews.filter((p) => p.kind === kind));
      setUnmatchedCount(data.unmatched_count);
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `t` only labels a rare error response; re-fetching on locale change would be wasteful
  }, [kind]);

  const handleApply = async () => {
    if (previews.length === 0) return;
    setError(null);
    setIsSubmitting(true);

    const updates = previews.map((p) => ({
      id: p.id,
      category_id: p.suggested_category_id,
    }));

    const res = await fetch("/api/transactions/apply-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates }),
    });

    setIsSubmitting(false);

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? t("transactions.applyRules.applyError"));
      return;
    }

    const data = (await res.json()) as { applied: number };
    setAppliedCount(data.applied);
  };

  // Group previews by category
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

  const kindLabel = t(kind === "expense" ? "transactions.applyRules.kindLabelExpense" : "transactions.applyRules.kindLabelIncome");

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl flex flex-col max-h-[85vh] dark:bg-zinc-900">
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
          ) : appliedCount !== null ? (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              <p className="text-lg font-semibold">{t("transactions.applyRules.appliedTitle")}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t(
                  kind === "expense"
                    ? "transactions.applyRules.appliedDescriptionExpense"
                    : "transactions.applyRules.appliedDescriptionIncome",
                  { count: appliedCount, plural: appliedCount > 1 ? "s" : "" },
                )}
              </p>
            </div>
          ) : previews.length === 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {t("transactions.applyRules.noMatch", { kindLabel })}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {t("transactions.applyRules.noMatchHint")}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">{previews.length}</span>{" "}
                {t(
                  kind === "expense"
                    ? "transactions.applyRules.willApplyCountExpense"
                    : "transactions.applyRules.willApplyCountIncome",
                  { kindLabel },
                )}
                {unmatchedCount > 0 && (
                  <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                    {t(
                      kind === "expense"
                        ? "transactions.applyRules.unmatchedSuffixExpense"
                        : "transactions.applyRules.unmatchedSuffixIncome",
                      { count: unmatchedCount, plural: unmatchedCount > 1 ? "s" : "" },
                    )}
                  </span>
                )}
              </p>

              <div className="space-y-2">
                {grouped.map((group) => (
                  <div
                    key={group.category_id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700"
                  >
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

              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
          {appliedCount !== null ? (
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
              {previews.length > 0 && (
                <button
                  onClick={() => void handleApply()}
                  disabled={isSubmitting}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50 dark:bg-white dark:text-zinc-900"
                >
                  {isSubmitting
                    ? t("transactions.applyRules.applying")
                    : t("transactions.applyRules.applyButton", {
                        count: previews.length,
                        plural: previews.length > 1 ? "s" : "",
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
