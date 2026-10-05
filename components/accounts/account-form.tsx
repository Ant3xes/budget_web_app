"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";

import { useLocale } from "@/components/locale-provider";
import { createAccountFormSchema } from "@/lib/accounts/account-form-schema";
import { formatCentsToEuros } from "@/lib/accounts/parse-euros-to-cents";
import { ACCOUNT_TYPES } from "@/lib/constants";

export type AccountFormValues = {
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  bank?: string;
  initialBalanceCents: number;
  currency: string;
};

// What the inputs hold: the balance is a text typed in euros.
type AccountFormInput = {
  name: string;
  type: (typeof ACCOUNT_TYPES)[number];
  bank?: string;
  initialBalance: string;
  currency: string;
};

interface AccountFormProps {
  accountId?: string;
  defaultValues?: AccountFormValues;
  onSuccess?: () => void;
}

export function AccountForm({ accountId, defaultValues, onSuccess }: AccountFormProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation messages need the current `t`, so the schema is built inside
  // the component (memoized on the locale) rather than at module scope.
  const accountSchema = useMemo(
    () =>
      createAccountFormSchema({
        nameRequired: t("accounts.form.nameRequired"),
        invalidBalance: t("accounts.form.initialBalanceInvalid"),
      }),
    [t],
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormInput, unknown, AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: defaultValues
      ? {
          name: defaultValues.name,
          type: defaultValues.type,
          bank: defaultValues.bank ?? "",
          initialBalance: formatCentsToEuros(defaultValues.initialBalanceCents),
          currency: defaultValues.currency,
        }
      : { name: "", type: "courant", bank: "", initialBalance: "", currency: "EUR" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setIsSubmitting(true);

    const response = await fetch("/api/accounts", {
      method: accountId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, id: accountId }),
    });

    setIsSubmitting(false);

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setError(result.error ?? t("accounts.form.saveError"));
      return;
    }

    if (onSuccess) {
      onSuccess();
      router.refresh();
    } else {
      router.push("/accounts");
      router.refresh();
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        {t("accounts.form.name")}
        <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" {...register("name")} />
        {errors.name ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.name.message}</p> : null}
      </label>

      <label className="block text-sm font-medium">
        {t("accounts.form.type")}
        <select className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" {...register("type")}>
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`accounts.types.${type}`)}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        {t("accounts.form.bank")} <span className="font-normal text-zinc-500 dark:text-zinc-400">{t("accounts.form.optional")}</span>
        <input
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder={t("accounts.form.bankPlaceholder")}
          {...register("bank")}
        />
      </label>

      <label className="block text-sm font-medium">
        {t("accounts.form.initialBalance")}
        <input
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          type="text"
          inputMode="decimal"
          placeholder="0,00"
          {...register("initialBalance")}
        />
        {errors.initialBalance ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.initialBalance.message}</p> : null}
      </label>

      <label className="block text-sm font-medium">
        {t("accounts.form.currency")}
        <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" maxLength={3} {...register("currency")} />
      </label>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

      <button
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {accountId ? t("common.actions.save") : t("accounts.form.createButton")}
      </button>
    </form>
  );
}
