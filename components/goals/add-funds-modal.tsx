"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { useLocale } from "@/components/locale-provider";
import { Modal } from "@/components/ui/modal";

type AddFundsFormValues = {
  amount: string;
};

interface AddFundsModalProps {
  goalId: string;
  goalName: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function AddFundsModal({ goalId, goalName, onSuccess, onClose }: AddFundsModalProps) {
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addFundsSchema = useMemo(
    () =>
      z.object({
        amount: z.string().regex(/^\d+([.,]\d{1,2})?$/, t("goals.addFundsModal.amountInvalid")),
      }),
    [t],
  );

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
      setError(result.error ?? t("goals.addFundsModal.saveError"));
      return;
    }

    onSuccess();
  });

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={t("goals.addFundsModal.title")}
      closeLabel={t("common.actions.close")}
    >
      <p className="mb-4 text-sm text-muted-foreground">
        {t("goals.addFundsModal.goalLabel")} <span className="font-medium text-foreground">{goalName}</span>
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">{t("goals.addFundsModal.amountLabel")}</label>
          <input
            {...register("amount")}
            type="text"
            inputMode="decimal"
            placeholder="200"
            autoFocus
            className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
          />
          {errors.amount && <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p>}
        </div>

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
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? t("common.state.saving") : t("goals.addFundsModal.submit")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
