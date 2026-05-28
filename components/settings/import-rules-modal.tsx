"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const ruleFormSchema = z.object({
  keyword: z.string().trim().min(1, "Mot-clé requis").max(200),
  category_id: z.string().uuid({ message: "Catégorie requise" }),
  kind: z.enum(["expense", "income"]),
});

type RuleFormValues = z.infer<typeof ruleFormSchema>;

type Category = { id: string; name: string; icon: string | null };

interface ImportRulesModalProps {
  ruleId?: string;
  defaultValues?: { keyword: string; category_id: string; kind: "expense" | "income" };
  onSuccess: () => void;
  onClose: () => void;
}

const KIND_LABELS: Record<string, string> = {
  expense: "Dépense",
  income: "Revenu",
};

export function ImportRulesModal({ ruleId, defaultValues, onSuccess, onClose }: ImportRulesModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
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

  const filteredCategories = categories.filter(
    (c) => (c as { kind?: string }).kind === selectedKind || (c as { kind?: string }).kind === undefined,
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
            {ruleId ? "Modifier la règle" : "Nouvelle règle"}
          </h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-zinc-400 hover:text-zinc-700"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="rule-keyword" className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Mot-clé</label>
            <input
              id="rule-keyword"
              {...register("keyword")}
              type="text"
              placeholder="ex: Netflix, Lidl, Loyer…"
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            />
            <p className="mt-1 text-xs text-zinc-500">
              Si la description d'une transaction contient ce mot-clé, la catégorie sera appliquée automatiquement.
            </p>
            {errors.keyword && <p className="mt-1 text-xs text-red-500">{errors.keyword.message}</p>}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Type de transaction</label>
            <select
              {...register("kind")}
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            >
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Catégorie à assigner</label>
            <select
              {...register("category_id")}
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            >
              <option value="">Sélectionner une catégorie…</option>
              {filteredCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.icon ? `${cat.icon} ` : ""}
                  {cat.name}
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
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "Enregistrement…" : ruleId ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
