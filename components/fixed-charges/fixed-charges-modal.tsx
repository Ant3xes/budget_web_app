"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const fixedChargeFormSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(100),
  amount: z.string().regex(/^\d+([.,]\d{1,2})?$/, "Montant invalide (ex: 850 ou 850,50)"),
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  account_id: z.string().optional(),
  category_id: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

type FixedChargeFormValues = z.infer<typeof fixedChargeFormSchema>;

type Account = { id: string; name: string };
type Category = { id: string; name: string; icon: string | null };

/**
 * Backend errors can be raw/technical (zod issue messages, Postgres error
 * text, "Invalid UUID" — see app/api/fixed-charges/route.ts) rather than
 * something a user should see verbatim. Only known French, user-facing
 * messages are passed through as-is; anything else falls back to a generic
 * message instead of leaking the raw string.
 */
const FRIENDLY_BACKEND_ERRORS = new Set(["Date invalide"]);

function resolveErrorMessage(raw: string | undefined): string {
  const fallback = "Impossible d'enregistrer la charge fixe, réessayez.";
  if (!raw) return fallback;
  return FRIENDLY_BACKEND_ERRORS.has(raw) ? raw : fallback;
}

interface FixedChargeModalProps {
  chargeId?: string;
  defaultValues?: Partial<{
    name: string;
    amount_cents: number;
    frequency: "monthly" | "quarterly" | "yearly";
    next_due_date: string;
    account_id: string | null;
    category_id: string | null;
    notes: string | null;
  }>;
  onSuccess: () => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const FREQUENCY_LABELS = {
  monthly: "Mensuelle",
  quarterly: "Trimestrielle",
  yearly: "Annuelle",
} as const;

export function FixedChargeModal({ chargeId, defaultValues, onSuccess, onClose }: FixedChargeModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FixedChargeFormValues>({
    resolver: zodResolver(fixedChargeFormSchema),
    defaultValues: {
      name: defaultValues?.name ?? "",
      amount: defaultValues?.amount_cents ? (defaultValues.amount_cents / 100).toFixed(2) : "",
      frequency: defaultValues?.frequency ?? "monthly",
      next_due_date: defaultValues?.next_due_date ?? today(),
      account_id: defaultValues?.account_id ?? "",
      category_id: defaultValues?.category_id ?? "",
      notes: defaultValues?.notes ?? "",
    },
  });

  useEffect(() => {
    const load = async () => {
      const [accRes, catRes] = await Promise.all([fetch("/api/accounts"), fetch("/api/categories")]);
      if (accRes.ok) {
        const d = (await accRes.json()) as { accounts: Account[] };
        setAccounts(d.accounts ?? []);
      }
      if (catRes.ok) {
        const d = (await catRes.json()) as { categories: Category[] };
        setCategories(d.categories ?? []);
      }
    };
    void load();
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    const amountCents = Math.round(parseFloat(values.amount.replace(",", ".")) * 100);

    const url = chargeId ? `/api/fixed-charges/${chargeId}` : "/api/fixed-charges";
    const method = chargeId ? "PATCH" : "POST";
    const body = {
      name: values.name,
      amount_cents: amountCents,
      frequency: values.frequency,
      next_due_date: values.next_due_date,
      account_id: values.account_id && values.account_id.length > 0 ? values.account_id : null,
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
      setError(resolveErrorMessage(result.error));
      return;
    }

    onSuccess();
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {chargeId ? "Modifier la charge fixe" : "Nouvelle charge fixe"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none dark:text-zinc-500 dark:hover:text-zinc-200" aria-label="Fermer">
            ✕
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nom</label>
            <input
              {...register("name")}
              type="text"
              placeholder="Loyer, Netflix, Orange Box…"
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Montant (€)</label>
              <input
                {...register("amount")}
                type="text"
                inputMode="decimal"
                placeholder="850"
                className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              />
              {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Fréquence</label>
              <select
                {...register("frequency")}
                className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              >
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Prochaine échéance</label>
            <input
              {...register("next_due_date")}
              type="date"
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            />
            {errors.next_due_date && (
              <p className="mt-1 text-xs text-red-500">{errors.next_due_date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Compte (optionnel)</label>
              <select
                {...register("account_id")}
                className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              >
                <option value="">Aucun</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Catégorie (optionnel)</label>
              <select
                {...register("category_id")}
                className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
              >
                <option value="">Aucune</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes (optionnel)</label>
            <textarea
              {...register("notes")}
              rows={2}
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            />
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
              {isSubmitting ? "Enregistrement…" : chargeId ? "Modifier" : "Créer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
