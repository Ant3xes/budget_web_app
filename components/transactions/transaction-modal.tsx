"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { resolveCategoryName } from "@/lib/i18n/category-name";

type TransactionFormValues = {
  account_id: string;
  amount: string;
  date: string;
  description: string;
  category_id?: string;
  notes?: string;
};

type Account = { id: string; name: string };
type Category = {
  id: string;
  name: string;
  kind: string;
  icon: string | null;
  is_default?: boolean;
  translation_key?: string | null;
};

interface TransactionModalProps {
  kind: "expense" | "income";
  transactionId?: string;
  defaultValues?: Partial<TransactionFormValues>;
  onSuccess: () => void;
  onClose: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export function TransactionModal({ kind, transactionId, defaultValues, onSuccess, onClose }: TransactionModalProps) {
  const { t } = useLocale();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation messages need the current `t`, so the schema is built inside
  // the component (memoized on the locale) rather than at module scope.
  const transactionSchema = useMemo(
    () =>
      z.object({
        account_id: z.string().uuid({ message: t("transactions.form.accountRequired") }),
        amount: z.string().regex(/^-?\d+([.,]\d{1,2})?$/, t("transactions.form.amountInvalid")),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("transactions.form.dateInvalid")),
        description: z.string().trim().min(1, t("transactions.form.descriptionRequired")).max(255),
        category_id: z.string().optional(),
        notes: z.string().trim().max(1000).optional(),
      }),
    [t],
  );

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
      setError(result.error ?? t("transactions.form.saveError"));
      return;
    }

    onSuccess();
  });

  const titleKey = transactionId
    ? kind === "expense"
      ? "transactions.form.titleEditExpense"
      : "transactions.form.titleEditIncome"
    : kind === "expense"
      ? "transactions.form.titleNewExpense"
      : "transactions.form.titleNewIncome";

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t(titleKey)}</h2>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="text-xl leading-none">
            ×
          </Button>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium">
            {t("transactions.form.account")}
            <Select className="mt-1" {...register("account_id")}>
              <option value="">{t("transactions.form.selectPlaceholder")}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            {errors.account_id ? <p className="mt-1 text-xs text-red-600">{errors.account_id.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            {t("transactions.form.amount")}
            <Input
              className="mt-1"
              placeholder={t("transactions.form.amountPlaceholder")}
              type="text"
              inputMode="decimal"
              {...register("amount")}
            />
            {errors.amount ? <p className="mt-1 text-xs text-red-600">{errors.amount.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            {t("transactions.form.date")}
            <Input className="mt-1" type="date" {...register("date")} />
            {errors.date ? <p className="mt-1 text-xs text-red-600">{errors.date.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            {t("transactions.form.description")}
            <Input className="mt-1" {...register("description")} />
            {errors.description ? <p className="mt-1 text-xs text-red-600">{errors.description.message}</p> : null}
          </label>

          <label className="block text-sm font-medium">
            {t("transactions.form.category")}
            <Select className="mt-1" {...register("category_id")}>
              <option value="">{t("transactions.form.noCategoryOption")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}
                  {resolveCategoryName(c, t)}
                </option>
              ))}
            </Select>
          </label>

          <label className="block text-sm font-medium">
            {t("transactions.form.notes")}
            <textarea
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              rows={2}
              {...register("notes")}
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("common.state.saving") : transactionId ? t("common.actions.update") : t("common.actions.create")}
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
