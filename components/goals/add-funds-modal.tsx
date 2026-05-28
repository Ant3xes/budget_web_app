"use client";

import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const addFundsSchema = z.object({
  amount: z.string().regex(/^\d+([.,]\d{1,2})?$/, "Montant invalide (ex: 200 ou 200,50)"),
});

type AddFundsFormValues = z.infer<typeof addFundsSchema>;

interface AddFundsModalProps {
  goalId: string;
  goalName: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function AddFundsModal({ goalId, goalName, onSuccess, onClose }: AddFundsModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AddFundsFormValues>({
    resolver: zodResolver(addFundsSchema),
    defaultValues: { amount: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    const amountCents = Math.round(parseFloat(values.amount.replace(",", ".")) * 100);

    const response = await fetch(`/api/savings-goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_funds", amount_cents: amountCents }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? "Impossible d'ajouter les fonds");
      return;
    }

    onSuccess();
  });

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Ajouter des fonds</h2>
          <button
            onClick={onClose}
            className="text-xl leading-none text-zinc-400 hover:text-zinc-700"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <p className="mb-4 text-sm text-zinc-500">
          Objectif : <span className="font-medium text-zinc-700">{goalName}</span>
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Montant à ajouter (€)</label>
            <input
              {...register("amount")}
              type="text"
              inputMode="decimal"
              placeholder="200"
              autoFocus
              className="w-full rounded-md border border-zinc-300 p-2 text-sm focus:border-blue-500 focus:outline-none dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            />
            {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount.message}</p>}
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
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? "Enregistrement…" : "Ajouter"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
