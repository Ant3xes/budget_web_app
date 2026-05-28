"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(80),
  kind: z.enum(["expense", "income", "transfer"]),
  color: z.string().optional(),
  icon: z.string().trim().max(10).optional(),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

interface CategoryFormProps {
  categoryId?: string;
  defaultValues?: CategoryFormValues;
  onSuccess: () => void;
  onCancel: () => void;
}

const KIND_LABELS: Record<string, string> = {
  expense: "Dépense",
  income: "Revenu",
  transfer: "Virement",
};

const DEFAULT_COLORS = [
  "#22c55e", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#f97316", "#06b6d4", "#6366f1", "#84cc16",
  "#f43f5e", "#64748b", "#94a3b8",
];

export function CategoryForm({ categoryId, defaultValues, onSuccess, onCancel }: CategoryFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setError(result.error ?? "Impossible de sauvegarder");
      return;
    }

    onSuccess();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block text-sm font-medium">
        Nom
        <input
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
          {...register("name")}
        />
        {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
      </label>

      <label className="block text-sm font-medium">
        Type
        <select
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
          {...register("kind")}
        >
          {Object.entries(KIND_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <div className="block text-sm font-medium">
        Icône (emoji)
        <input
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
          placeholder="ex: 🛒"
          {...register("icon")}
        />
      </div>

      <div className="block text-sm font-medium">
        Couleur
        <div className="mt-2 flex flex-wrap gap-2">
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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isSubmitting ? "Sauvegarde…" : categoryId ? "Mettre à jour" : "Créer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-300"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}
