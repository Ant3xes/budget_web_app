"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { X } from "lucide-react";
import { z } from "zod";

import { CATEGORY_COLOR_FALLBACK, CATEGORY_COLOR_SWATCHES } from "@/lib/constants";

const goalFormSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  target_amount: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Montant invalide (ex: 1000 ou 1000,50)"),
  current_amount: z
    .string()
    .regex(/^\d+([.,]\d{1,2})?$/, "Montant invalide")
    .optional()
    .or(z.literal("")),
  deadline: z.string().optional().or(z.literal("")),
  color: z.string().optional(),
  icon: z.string().trim().max(10).optional(),
  linked_category_id: z.string().uuid().optional().or(z.literal("")),
});

type GoalFormValues = z.infer<typeof goalFormSchema>;

type Category = { id: string; name: string; icon: string | null };

interface GoalsModalProps {
  goalId?: string;
  defaultValues?: {
    name: string;
    target_amount_cents: number;
    current_amount_cents: number;
    deadline?: string | null;
    color?: string | null;
    icon?: string | null;
    linked_category_id?: string | null;
  };
  onSuccess: () => void;
  onClose: () => void;
}

// Same underlying palette as the category picker (components/settings/category-
// form.tsx), minus the fallback gray — preserves this modal's exact
// pre-existing 12-swatch selection (Étape 0 is a non-visual refactor; unifying
// to the full swatch list is deferred to Étape 2 as a deliberate visual
// decision, not a side effect of centralizing the constant).
const DEFAULT_COLORS = CATEGORY_COLOR_SWATCHES.filter((color) => color !== CATEGORY_COLOR_FALLBACK);

export function GoalsModal({ goalId, defaultValues, onSuccess, onClose }: GoalsModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GoalFormValues>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      target_amount: defaultValues ? (defaultValues.target_amount_cents / 100).toFixed(2) : "",
      current_amount: defaultValues ? (defaultValues.current_amount_cents / 100).toFixed(2) : "0",
      deadline: defaultValues?.deadline ?? "",
      color: defaultValues?.color ?? "#3b82f6",
      icon: defaultValues?.icon ?? "",
      linked_category_id: defaultValues?.linked_category_id ?? "",
    },
  });

  const selectedColor = watch("color");
  const linkedCategoryId = watch("linked_category_id");
  const isLinked = !!linkedCategoryId;

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

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    const targetCents = Math.round(parseFloat(values.target_amount.replace(",", ".")) * 100);
    const currentCents =
      !isLinked && values.current_amount
        ? Math.round(parseFloat(values.current_amount.replace(",", ".")) * 100)
        : undefined;

    const body = {
      name: values.name,
      target_amount_cents: targetCents,
      ...(currentCents !== undefined && { current_amount_cents: currentCents }),
      deadline: values.deadline || null,
      color: values.color || null,
      icon: values.icon || null,
      linked_category_id: values.linked_category_id || null,
    };

    const url = goalId ? `/api/savings-goals/${goalId}` : "/api/savings-goals";
    const method = goalId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "Impossible de sauvegarder");
      return;
    }

    onSuccess();
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {goalId ? "Modifier l'objectif" : "Nouvel objectif"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-700"
            aria-label="Fermer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="goal-name" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nom</label>
            <input
              id="goal-name"
              {...register("name")}
              type="text"
              placeholder="Vacances, Voiture…"
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Icône (emoji)</label>
              <input
                {...register("icon")}
                type="text"
                placeholder="🏖️"
                className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="goal-target" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Montant cible (€)</label>
              <input
                id="goal-target"
                {...register("target_amount")}
                type="text"
                inputMode="decimal"
                placeholder="2000"
                className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              />
              {errors.target_amount && (
                <p className="mt-1 text-xs text-red-500">{errors.target_amount.message}</p>
              )}
            </div>
          </div>

          {!isLinked && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Montant actuel (€)
              </label>
              <input
                {...register("current_amount")}
                type="text"
                inputMode="decimal"
                placeholder="0"
                className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              />
              {errors.current_amount && (
                <p className="mt-1 text-xs text-red-500">{errors.current_amount.message}</p>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Date limite (optionnel)</label>
            <input
              {...register("deadline")}
              type="date"
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Catégorie liée (optionnel — suivi automatique)
            </label>
            <select
              {...register("linked_category_id")}
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            >
              <option value="">Aucune (mode manuel)</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon ? `${cat.icon} ` : ""}
                  {(cat as { name: string }).name}
                </option>
              ))}
            </select>
            {isLinked && (
              <p className="mt-1 text-xs text-zinc-500">
                Le montant sera calculé automatiquement depuis les transactions de cette catégorie.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Couleur</label>
            <div className="mt-1 flex flex-wrap gap-2">
              {DEFAULT_COLORS.map((color) => (
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

          {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Enregistrement…" : goalId ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
