"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type TransferFormValues = {
  from_account_id: string;
  to_account_id: string;
  amount: string;
  date: string;
  description?: string;
};

type Account = { id: string; name: string };

interface TransferModalProps {
  transferId?: string;
  defaultValues?: Partial<TransferFormValues>;
  onSuccess: () => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TransferModal({ transferId, defaultValues, onSuccess, onClose }: TransferModalProps) {
  const { t } = useLocale();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation messages need the current `t`, so the schema is built inside
  // the component (memoized on the locale) rather than at module scope.
  const transferSchema = useMemo(
    () =>
      z
        .object({
          from_account_id: z.string().uuid({ message: t("transactions.transfers.form.fromAccountRequired") }),
          to_account_id: z.string().uuid({ message: t("transactions.transfers.form.toAccountRequired") }),
          amount: z.string().regex(/^\d+([.,]\d{1,2})?$/, t("transactions.transfers.form.amountInvalid")),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("transactions.transfers.form.dateInvalid")),
          description: z.string().trim().max(255).optional(),
        })
        .refine((d) => d.from_account_id !== d.to_account_id, {
          message: t("transactions.transfers.form.accountsMustDiffer"),
          path: ["to_account_id"],
        }),
    [t],
  );

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
      setError(result.error ?? t("transactions.transfers.form.saveError"));
      return;
    }

    onSuccess();
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {transferId ? t("transactions.transfers.form.titleEdit") : t("transactions.transfers.form.titleNew")}
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-xl leading-none">
            ×
          </Button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {!transferId && (
            <>
              <label className="block text-sm font-medium">
                {t("transactions.transfers.form.fromAccount")}
                <Select className="mt-1" {...register("from_account_id")}>
                  <option value="">{t("transactions.form.selectPlaceholder")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                {errors.from_account_id ? (
                  <p className="mt-1 text-xs text-red-600">{errors.from_account_id.message}</p>
                ) : null}
              </label>

              <label className="block text-sm font-medium">
                {t("transactions.transfers.form.toAccount")}
                <Select className="mt-1" {...register("to_account_id")}>
                  <option value="">{t("transactions.form.selectPlaceholder")}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </Select>
                {errors.to_account_id ? (
                  <p className="mt-1 text-xs text-red-600">{errors.to_account_id.message}</p>
                ) : null}
              </label>
            </>
          )}

          <label className="block text-sm font-medium">
            {t("transactions.transfers.form.amount")}
            <Input
              className="mt-1"
              placeholder={t("transactions.transfers.form.amountPlaceholder")}
              type="text"
              inputMode="decimal"
              {...register("amount")}
            />
            {errors.amount ? <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            {t("transactions.transfers.form.date")}
            <Input className="mt-1" type="date" {...register("date")} />
            {errors.date ? <p className="mt-1 text-xs text-red-600">{errors.date.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            {t("transactions.transfers.form.description")}
            <Input className="mt-1" {...register("description")} />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.state.saving") : transferId ? t("common.actions.update") : t("common.actions.create")}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.actions.cancel")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
