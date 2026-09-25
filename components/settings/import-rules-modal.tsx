"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale } from "@/components/locale-provider";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
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

type SpaceOption = { id: string; name: string; kind: "personal" | "shared"; default_share_percent: number | null };
type ShareCategory = Category & { kind?: string };

interface ImportRulesModalProps {
  ruleId?: string;
  defaultValues?: {
    keyword: string;
    category_id: string;
    kind: "expense" | "income";
    share_space_id?: string | null;
    share_category_id?: string | null;
    share_payer_percent?: number | null;
  };
  /** Sharing is only offered from a personal space. */
  spaceKind?: "personal" | "shared";
  onSuccess: () => void;
  onClose: () => void;
}

export function ImportRulesModal({ ruleId, defaultValues, spaceKind = "personal", onSuccess, onClose }: ImportRulesModalProps) {
  const { t } = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [spaces, setSpaces] = useState<SpaceOption[]>([]);
  const [shareEnabled, setShareEnabled] = useState(!!defaultValues?.share_space_id);
  const [shareSpaceId, setShareSpaceId] = useState(defaultValues?.share_space_id ?? "");
  const [shareCategoryId, setShareCategoryId] = useState(defaultValues?.share_category_id ?? "");
  const [sharePercent, setSharePercent] = useState(
    defaultValues?.share_payer_percent != null ? String(defaultValues.share_payer_percent) : "",
  );
  const [shareCategories, setShareCategories] = useState<ShareCategory[]>([]);

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
      }
    };
    void load();
  }, []);

  // `category_id` is registered via `register()`, so at mount time (categories
  // still []) there's no matching <option> for the rule's real category_id, and
  // the DOM select never re-syncs by itself once the options exist. Push the
  // form's actual value back onto the select — but in an effect, i.e. AFTER
  // React rendered the <option>s: doing it right after `setCategories()` in the
  // fetch callback ran before they existed and the select stayed on "Choose…".
  // Skipped when the user already picked something while the fetch was in
  // flight, or we'd silently clobber their choice. `setValue` (not `reset`) so
  // keyword/kind are untouched.
  useEffect(() => {
    if (categories.length === 0 || categoryTouchedRef.current) return;
    setValue("category_id", defaultValues?.category_id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories]);

  const sharedSpaces = spaces.filter((s) => s.kind === "shared");

  useEffect(() => {
    if (spaceKind !== "personal") return;
    const load = async () => {
      const res = await fetch("/api/spaces");
      if (!res.ok) return;
      const data = (await res.json()) as { spaces: SpaceOption[] };
      const list = data.spaces ?? [];
      setSpaces(list);
      const shared = list.filter((s) => s.kind === "shared");
      // Preselect when there is no ambiguity.
      setShareSpaceId((current) => current || (shared.length === 1 ? shared[0]!.id : ""));
    };
    void load();
  }, [spaceKind]);

  useEffect(() => {
    if (!shareSpaceId) return;
    let cancelled = false;
    const load = async () => {
      const res = await fetch(`/api/spaces/${shareSpaceId}/categories`);
      if (cancelled) return;
      if (res.ok) {
        const data = (await res.json()) as { categories: ShareCategory[] };
        setShareCategories((data.categories ?? []).filter((c) => c.kind === "expense"));
      } else {
        setShareCategories([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [shareSpaceId]);

  const showShareSection = spaceKind === "personal" && selectedKind === "expense" && sharedSpaces.length > 0;
  const shareActive = showShareSection && shareEnabled;
  const chosenSpace = sharedSpaces.find((s) => s.id === shareSpaceId);
  const parsedPercent = sharePercent.trim() === "" ? null : Number(sharePercent.replace(",", "."));
  const percentValid = parsedPercent === null || (Number.isFinite(parsedPercent) && parsedPercent >= 0 && parsedPercent <= 100);

  const filteredCategories = categories.filter(
    (c) =>
      (c as { kind?: string }).kind === selectedKind ||
      (c as { kind?: string }).kind === undefined ||
      c.id === defaultValues?.category_id,
  );

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    if (shareActive && !shareSpaceId) {
      setError(t("importRules.form.shareSpaceRequired"));
      return;
    }
    if (shareActive && !percentValid) {
      setError(t("importRules.form.sharePercentInvalid"));
      return;
    }
    setIsSubmitting(true);

    const shareFields = shareActive
      ? {
          share_space_id: shareSpaceId,
          share_category_id: shareCategoryId || null,
          share_payer_percent: parsedPercent,
        }
      : // Clear a possibly saved share when the switch is off or the kind is
        // no longer expense; leave it untouched when the section is unavailable
        // (shared space, or spaces not loaded).
        showShareSection || selectedKind === "income"
        ? { share_space_id: null, share_category_id: null, share_payer_percent: null }
        : {};

    const url = ruleId ? `/api/import-rules/${ruleId}` : "/api/import-rules";
    const method = ruleId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, ...shareFields }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { error?: string };
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
          {errors.keyword && <p className="mt-1 text-xs text-red-600">{errors.keyword.message}</p>}
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
            <p className="mt-1 text-xs text-red-600">{errors.category_id.message}</p>
          )}
        </div>

        {showShareSection && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <label className="flex items-start gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={shareEnabled}
                onChange={(e) => setShareEnabled(e.target.checked)}
              />
              <span>
                {t("importRules.form.shareToggle")}
                <span className="block text-xs font-normal text-muted-foreground">{t("importRules.form.shareHint")}</span>
              </span>
            </label>

            {shareEnabled && (
              <>
                <label className="block text-sm font-medium">
                  {t("importRules.form.shareSpace")}
                  <Select
                    className="mt-1"
                    value={shareSpaceId}
                    onChange={(e) => {
                      setShareSpaceId(e.target.value);
                      setShareCategoryId("");
                    }}
                  >
                    <option value="">{t("importRules.form.shareSpacePlaceholder")}</option>
                    {sharedSpaces.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="block text-sm font-medium">
                  {t("importRules.form.shareCategory")}
                  <Select className="mt-1" value={shareCategoryId} onChange={(e) => setShareCategoryId(e.target.value)}>
                    <option value="">{t("importRules.form.shareNoCategory")}</option>
                    {shareCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}
                        {resolveCategoryName(c, t)}
                      </option>
                    ))}
                  </Select>
                </label>

                <label className="block text-sm font-medium">
                  {t("importRules.form.sharePercent")}
                  <Input
                    className="mt-1"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={100}
                    step="any"
                    value={sharePercent}
                    placeholder={String(chosenSpace?.default_share_percent ?? 50)}
                    onChange={(e) => setSharePercent(e.target.value)}
                  />
                  <span className="mt-1 block text-xs font-normal text-muted-foreground">
                    {t("importRules.form.sharePercentHint")}
                  </span>
                  {!percentValid ? (
                    <span className="mt-1 block text-xs text-red-600">{t("importRules.form.sharePercentInvalid")}</span>
                  ) : null}
                </label>
              </>
            )}
          </div>
        )}

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
