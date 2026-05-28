"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const transferSchema = z.object({
  from_account_id: z.string().uuid({ message: "Compte source requis" }),
  to_account_id: z.string().uuid({ message: "Compte destination requis" }),
  amount: z.string().regex(/^\d+([.,]\d{1,2})?$/, "Montant invalide (doit être positif)"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide"),
  description: z.string().trim().max(255).optional(),
}).refine((d) => d.from_account_id !== d.to_account_id, {
  message: "Les comptes source et destination doivent être différents",
  path: ["to_account_id"],
});

type TransferFormValues = z.infer<typeof transferSchema>;

type Account = { id: string; name: string };

interface TransferModalProps {
  transferId?: string;
  defaultValues?: Partial<TransferFormValues>;
  onSuccess: () => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TransferModal({ transferId, defaultValues, onSuccess, onClose }: TransferModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      from_account_id: defaultValues?.from_account_id ?? "",
      to_account_id: defaultValues?.to_account_id ?? "",
      amount: defaultValues?.amount ?? "",
      date: defaultValues?.date ?? today(),
      description: defaultValues?.description ?? "Virement",
    },
  });

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/accounts");
      if (res.ok) {
        const data = (await res.json()) as { accounts: Account[] };
        setAccounts(data.accounts ?? []);
      }
    };
    void load();
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    const amountStr = values.amount.replace(",", ".");
    const amountCents = Math.round(parseFloat(amountStr) * 100);

    const url = transferId ? `/api/transfers/${transferId}` : "/api/transfers";
    const method = transferId ? "PATCH" : "POST";

    const body = transferId
      ? { amount_cents: amountCents, date: values.date, description: values.description }
      : {
          from_account_id: values.from_account_id,
          to_account_id: values.to_account_id,
          amount_cents: amountCents,
          date: values.date,
          description: values.description || "Virement",
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {transferId ? "Modifier le virement" : "Nouveau virement"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none dark:text-zinc-500 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {!transferId && (
            <>
              <label className="block text-sm font-medium">
                Compte source
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  {...register("from_account_id")}
                >
                  <option value="">— Sélectionner —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {errors.from_account_id ? (
                  <p className="mt-1 text-xs text-red-600">{errors.from_account_id.message}</p>
                ) : null}
              </label>

              <label className="block text-sm font-medium">
                Compte destination
                <select
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  {...register("to_account_id")}
                >
                  <option value="">— Sélectionner —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                {errors.to_account_id ? (
                  <p className="mt-1 text-xs text-red-600">{errors.to_account_id.message}</p>
                ) : null}
              </label>
            </>
          )}

          <label className="block text-sm font-medium">
            Montant (€)
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              placeholder="ex: 500.00"
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
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {isSubmitting ? "Sauvegarde…" : transferId ? "Mettre à jour" : "Créer"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-300"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
