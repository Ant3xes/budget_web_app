"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale } from "@/components/locale-provider";
import { Modal } from "@/components/ui/modal";
import { resolveCategoryName } from "@/lib/i18n/category-name";

type RuleFormValues = {
  keyword: string;
  category_id: string;
  kind: "expense" | "income";
};

type Category = {
  id: string;
  name: string;
  icon: string | null;
  is_default?: boolean | null;
  translation_key?: string | null;
};

interface ImportRulesModalProps {
  ruleId?: string;
  defaultValues?: { keyword: string; category_id: string; kind: "expense" | "income" };
  onSuccess: () => void;
  onClose: () => void;
}

export function ImportRulesModal({ ruleId, defaultValues, onSuccess, onClose }: ImportRulesModalProps) {
  const { t } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation messages need the current `t`, so the schema is built inside
  // the component (memoized on the locale) rather than at module scope.
  const ruleFormSchema = useMemo(
    () =>
      z.object({
        keyword: z.string().trim().min(1, t("importRules.form.keywordRequired")).max(200),
        category_id: z.string().uuid({ message: t("importRules.form.categoryRequired") }),
        kind: z.enum(["expense", "income"]),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: {
      keyword: defaultValues?.keyword ?? "",
      category_id: defaultValues?.category_id ?? "",
      kind: defaultValues?.kind ?? "expense",
    },
  });

  const selectedKind = watch("kind");
  // Tracks whether the user has touched the category select themselves —
  // read via a ref (not `formState.dirtyFields`) so the check below sees the
  // latest value even though it runs inside an async callback captured at
  // mount, not at render time.
  const categoryTouchedRef = useRef(false);
  const categoryIdField = register("category_id");

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = (await res.json()) as { categories: Category[] };
        setCategories(data.categories ?? []);
        // `category_id` is registered via `register()`, so at mount time
        // (categories still []) there's no matching <option> for the rule's
        // real category_id yet, and the DOM select never re-syncs once the
        // options exist. Force it back onto the form's actual value now
        // that the <option> elements exist — but only if the user hasn't
        // already picked something themselves while this fetch was in
        // flight, or we'd silently clobber their choice. `setValue` (not
        // `reset`) so we don't touch keyword/kind.
        if (!categoryTouchedRef.current) {
          setValue("category_id", defaultValues?.category_id ?? "");
        }
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCategories = categories.filter(
    (c) =>
      (c as { kind?: string }).kind === selectedKind ||
      (c as { kind?: string }).kind === undefined ||
      c.id === defaultValues?.category_id,
  );

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    const url = ruleId ? `/api/import-rules/${ruleId}` : "/api/import-rules";
    const method = ruleId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? t("importRules.form.saveError"));
      return;
    }

    onSuccess();
  });

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={ruleId ? t("importRules.editRule") : t("importRules.newRule")}
      closeLabel={t("common.actions.close")}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label htmlFor="rule-keyword" className="mb-1 block text-sm font-medium text-foreground">{t("importRules.form.keywordLabel")}</label>
          <input
            id="rule-keyword"
            {...register("keyword")}
            type="text"
            placeholder={t("importRules.form.keywordPlaceholder")}
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("importRules.form.keywordHint")}
          </p>
          {errors.keyword && <p className="mt-1 text-xs text-red-500">{errors.keyword.message}</p>}
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">{t("importRules.form.kindLabel")}</label>
          <select
            {...register("kind")}
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
          >
            {(["expense", "income"] as const).map((kind) => (
              <option key={kind} value={kind}>
                {t(`categories.kind.${kind}`)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">{t("importRules.form.categoryLabel")}</label>
          <select
            {...categoryIdField}
            onChange={(e) => {
              categoryTouchedRef.current = true;
              void categoryIdField.onChange(e);
            }}
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
          >
            <option value="">{t("importRules.form.categoryPlaceholder")}</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.icon ? `${cat.icon} ` : ""}
                {resolveCategoryName(cat, t)}
              </option>
            ))}
          </select>
          {errors.category_id && (
            <p className="mt-1 text-xs text-red-500">{errors.category_id.message}</p>
          )}
        </div>

        {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
          >
            {t("common.actions.cancel")}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? t("importRules.form.saving") : ruleId ? t("common.actions.edit") : t("common.actions.create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
