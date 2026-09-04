"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const budgetFormSchema = z.object({
  category_id: z.string().uuid({ message: "Catégorie requise" }),
  amount: z.string().regex(/^\d+([.,]\d{1,2})?$/, "Montant invalide (ex: 400 ou 400,50)"),
});

type BudgetFormValues = z.infer<typeof budgetFormSchema>;

type Category = { id: string; name: string; icon: string | null };

interface BudgetModalProps {
  month: string; // YYYY-MM
  budgetId?: string;
  defaultValues?: { category_id: string; amount_cents: number };
  onSuccess: () => void;
  onClose: () => void;
}

export function BudgetModal({ month, budgetId, defaultValues, onSuccess, onClose }: BudgetModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const defaultAmount = defaultValues ? (defaultValues.amount_cents / 100).toFixed(2) : "";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: {
      category_id: defaultValues?.category_id ?? "",
      amount: defaultAmount,
    },
  });

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = (await res.json()) as { categories: Category[] };
        setCategories((data.categories ?? []).filter((c) => (c as { kind?: string }).kind === "expense"));
      }
    };
    void load();
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    const amountCents = Math.round(parseFloat(values.amount.replace(",", ".")) * 100);

    const url = budgetId ? `/api/budgets/${budgetId}` : "/api/budgets";
    const method = budgetId ? "PATCH" : "POST";
    const body = budgetId
      ? { amount_cents: amountCents }
      : { category_id: values.category_id, month, amount_cents: amountCents };

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

  const [year, mon] = month.split("-");
  const monthLabel = new Date(`${year}-${mon}-01`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {budgetId ? "Modifier l'enveloppe" : "Nouvelle enveloppe"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none dark:text-zinc-500 dark:hover:text-zinc-200" aria-label="Fermer">
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">Mois : {monthLabel}</p>

        <form onSubmit={onSubmit} className="space-y-4">
          {!budgetId && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Catégorie</label>
              <select
                {...register("category_id")}
                className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              >
                <option value="">Sélectionner une catégorie…</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="mt-1 text-xs text-red-500">{errors.category_id.message}</p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="budget-amount" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Montant (€)</label>
            <input
              id="budget-amount"
              {...register("amount")}
              type="text"
              inputMode="decimal"
              placeholder="400"
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
            {errors.amount && (
              <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>
            )}
          </div>

          {error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Enregistrement…" : budgetId ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
