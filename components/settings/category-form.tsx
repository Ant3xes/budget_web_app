"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale } from "@/components/locale-provider";
import { CATEGORY_COLOR_SWATCHES } from "@/lib/constants";

export type CategoryFormValues = {
  name: string;
  kind: "expense" | "income" | "transfer";
  color?: string;
  icon?: string;
};

interface CategoryFormProps {
  categoryId?: string;
  defaultValues?: CategoryFormValues;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CategoryForm({ categoryId, defaultValues, onSuccess, onCancel }: CategoryFormProps) {
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation messages need the current `t`, so the schema is built inside
  // the component (memoized on the locale) rather than at module scope.
  const categorySchema = useMemo(
    () =>
      z.object({
        name: z.string().trim().min(1, t("settings.categories.form.nameRequired")).max(80),
        kind: z.enum(["expense", "income", "transfer"]),
        color: z.string().optional(),
        icon: z.string().trim().max(10).optional(),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: defaultValues ?? {
      name: "",
      kind: "expense",
      color: "#22c55e",
      icon: "",
    },
  });

  const selectedColor = watch("color");

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    const url = categoryId ? `/api/categories/${categoryId}` : "/api/categories";
    const method = categoryId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? t("settings.categories.form.saveError"));
      return;
    }

    onSuccess();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        {t("settings.categories.form.name")}
        <input
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
          {...register("name")}
        />
        {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
      </label>

      <label className="block text-sm font-medium">
        {t("settings.categories.form.type")}
        <select
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
          {...register("kind")}
        >
          {(["expense", "income", "transfer"] as const).map((kind) => (
            <option key={kind} value={kind}>
              {t(`categories.kind.${kind}`)}
            </option>
          ))}
        </select>
      </label>

      <div className="block text-sm font-medium">
        {t("settings.categories.form.icon")}
        <input
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
          placeholder={t("settings.categories.form.iconPlaceholder")}
          {...register("icon")}
        />
      </div>

      <div className="block text-sm font-medium">
        {t("settings.categories.form.color")}
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORY_COLOR_SWATCHES.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setValue("color", color)}
              className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: selectedColor === color ? "#000" : "transparent",
              }}
            />
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isSubmitting ? t("common.state.saving") : categoryId ? t("common.actions.update") : t("common.actions.create")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-300"
        >
          {t("common.actions.cancel")}
        </button>
      </div>
    </form>
  );
}
