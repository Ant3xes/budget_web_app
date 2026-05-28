"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const transactionSchema = z.object({
  account_id: z.string().uuid({ message: "Compte requis" }),
  amount: z.string().regex(/^-?\d+([.,]\d{1,2})?$/, "Montant invalide"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  description: z.string().trim().min(1, "Description requise").max(255),
  category_id: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string; icon: string | null };

interface TransactionModalProps {
  kind: "expense" | "income";
  transactionId?: string;
  defaultValues?: Partial<TransactionFormValues>;
  onSuccess: () => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TransactionModal({ kind, transactionId, defaultValues, onSuccess, onClose }: TransactionModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      account_id: defaultValues?.account_id ?? "",
      amount: defaultValues?.amount ?? "",
      date: defaultValues?.date ?? today(),
      description: defaultValues?.description ?? "",
      category_id: defaultValues?.category_id ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  useEffect(() => {
    const load = async () => {
      const [accountsRes, categoriesRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/categories"),
      ]);
      if (accountsRes.ok) {
        const data = (await accountsRes.json()) as { accounts: Account[] };
        setAccounts(data.accounts ?? []);
      }
      if (categoriesRes.ok) {
        const data = (await categoriesRes.json()) as { categories: Category[] };
        setCategories((data.categories ?? []).filter((c) => c.kind === kind));
      }
    };
    void load();
  }, [kind]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    const amountStr = values.amount.replace(",", ".");
    const amountCents = Math.round(parseFloat(amountStr) * 100);
    // For expenses, store as negative; for incomes, positive
    const signedCents = kind === "expense" ? -Math.abs(amountCents) : Math.abs(amountCents);

    const url = transactionId ? `/api/transactions/${transactionId}` : "/api/transactions";
    const method = transactionId ? "PATCH" : "POST";

    const body = {
      ...(transactionId ? {} : { kind }),
      account_id: values.account_id,
      amount_cents: signedCents,
      date: values.date,
      description: values.description,
      category_id: values.category_id && values.category_id.length > 0 ? values.category_id : null,
      notes: values.notes || null,
    };

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

  const kindLabel = kind === "expense" ? "Dépense" : "Revenu";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {transactionId ? `Modifier la ${kindLabel.toLowerCase()}` : `Nouvelle ${kindLabel.toLowerCase()}`}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none dark:text-zinc-500 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium">
            Compte
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              {...register("account_id")}
            >
              <option value="">— Sélectionner —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            {errors.account_id ? <p className="mt-1 text-xs text-red-600">{errors.account_id.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            Montant (€)
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="ex: 45.30"
              type="text"
              inputMode="decimal"
              {...register("amount")}
            />
            {errors.amount ? <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            Date
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              type="date"
              {...register("date")}
            />
            {errors.date ? <p className="mt-1 text-xs text-red-600">{errors.date.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            Description
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              {...register("description")}
            />
            {errors.description ? <p className="mt-1 text-xs text-red-600">{errors.description.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            Catégorie
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              {...register("category_id")}
            >
              <option value="">— Sans catégorie —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium">
            Notes
            <textarea
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              rows={2}
              {...register("notes")}
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {isSubmitting ? "Sauvegarde…" : transactionId ? "Mettre à jour" : "Créer"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
