"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale } from "@/components/locale-provider";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { resolveCategoryName } from "@/lib/i18n/category-name";

type TransactionFormValues = {
  account_id?: string;
  amount: string;
  date: string;
  description: string;
  category_id?: string;
  notes?: string;
  // Transfer type only (issue 115): money leaves `from_account_id` for `to_account_id`.
  from_account_id?: string;
  to_account_id?: string;
};

type TransactionType = "expense" | "income" | "transfer";

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
  kind: TransactionType;
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
  const [ruleMessage, setRuleMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Type selected in the form; `kind` is the type the row has today (issue 115).
  const [type, setType] = useState<TransactionType>(kind);
  // Leaving a transfer deletes its mirror line: ask before sending.
  const [confirmingMirrorDelete, setConfirmingMirrorDelete] = useState(false);
  const leavingTransfer = !!transactionId && kind === "transfer" && type !== "transfer";

  // Validation messages need the current `t`, so the schema is built inside
  // the component (memoized on the locale) rather than at module scope.
  const transactionSchema = useMemo(
    () =>
      z.object({
        account_id: z.string().optional(),
        from_account_id: z.string().optional(),
        to_account_id: z.string().optional(),
        amount: z.string().regex(/^-?\d+([.,]\d{1,2})?$/, t("transactions.form.amountInvalid")),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("transactions.form.dateInvalid")),
        description: z.string().trim().min(1, t("transactions.form.descriptionRequired")).max(255),
        category_id: z.string().optional(),
        notes: z.string().trim().max(1000).optional(),
      })
        .superRefine((values, ctx) => {
          const required = (path: "account_id" | "from_account_id" | "to_account_id", message: string) => {
            if (!z.string().uuid().safeParse(values[path]).success) ctx.addIssue({ code: "custom", path: [path], message });
          };
          if (type === "transfer") {
            required("from_account_id", t("transactions.transfers.form.fromAccountRequired"));
            required("to_account_id", t("transactions.transfers.form.toAccountRequired"));
            if (values.from_account_id && values.from_account_id === values.to_account_id) {
              ctx.addIssue({ code: "custom", path: ["to_account_id"], message: t("transactions.transfers.form.accountsMustDiffer") });
            }
          } else {
            required("account_id", t("transactions.form.accountRequired"));
            // A transfer has no category: leaving one needs an explicit choice.
            if (leavingTransfer && !values.category_id) {
              ctx.addIssue({ code: "custom", path: ["category_id"], message: t("transactions.form.categoryRequiredAfterTransfer") });
            }
          }
        }),
    [t, type, leavingTransfer],
  );

  const {
    control,
    register,
    setValue,
    getValues,
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
      from_account_id: defaultValues?.from_account_id ?? "",
      to_account_id: defaultValues?.to_account_id ?? "",
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
        setCategories(data.categories ?? []);
      }
    };
    void load();
  }, []);

  // Category options follow the selected type (a transfer has none).
  const typeCategories = useMemo(() => categories.filter((c) => c.kind === type), [categories, type]);

  const changeType = (next: TransactionType) => {
    if (next === type) return;
    setType(next);
    setConfirmingMirrorDelete(false);
    // A category only applies within its own type.
    setValue("category_id", "");
    if (next === "transfer") {
      // Seed the side the row already sits on with its current account.
      const account = getValues("account_id");
      if (!getValues("from_account_id") && !getValues("to_account_id") && account) {
        setValue(kind === "income" ? "to_account_id" : "from_account_id", account);
      }
    } else if (kind === "transfer" && !getValues("account_id")) {
      setValue("account_id", getValues("from_account_id") || getValues("to_account_id") || "");
    }
  };

  const submit = async (values: TransactionFormValues) => {
    setError(null);
    setIsSubmitting(true);

    const amountStr = values.amount.replace(",", ".");
    const amountCents = Math.round(parseFloat(amountStr) * 100);
    // For expenses, store as negative; for incomes, positive (a transfer's
    // signs are decided server-side: the API receives the absolute amount).
    const signedCents = type === "expense" ? -Math.abs(amountCents) : Math.abs(amountCents);

    const url = transactionId ? `/api/transactions/${transactionId}` : "/api/transactions";
    const method = transactionId ? "PATCH" : "POST";

    const body = {
      // Edit: the type is only sent when it changes (issue 115).
      ...(!transactionId || type !== kind ? { kind: type } : {}),
      ...(type === "transfer"
        ? { from_account_id: values.from_account_id, to_account_id: values.to_account_id }
        : { account_id: values.account_id }),
      amount_cents: signedCents,
      date: values.date,
      description: values.description,
      category_id:
        type !== "transfer" && values.category_id && values.category_id.length > 0 ? values.category_id : null,
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

    // Issue 116: a category change created/updated an import rule; show it
    // briefly before closing.
    const result = (await response.json().catch(() => ({}))) as { rule?: "created" | "updated" | null };
    if (result.rule) {
      setRuleMessage(t(result.rule === "created" ? "transactions.form.ruleCreated" : "transactions.form.ruleUpdated"));
      setTimeout(onSuccess, 1200);
      return;
    }
    onSuccess();
  };

  const onSubmit = handleSubmit(async (values) => {
    if (leavingTransfer && !confirmingMirrorDelete) {
      setConfirmingMirrorDelete(true);
      return;
    }
    await submit(values);
  });

  const titleKey = transactionId
    ? type === "transfer"
      ? "transactions.transfers.form.titleEdit"
      : type === "expense"
      ? "transactions.form.titleEditExpense"
      : "transactions.form.titleEditIncome"
    : type === "transfer"
      ? "transactions.transfers.form.titleNew"
      : type === "expense"
      ? "transactions.form.titleNewExpense"
      : "transactions.form.titleNewIncome";

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={t(titleKey)}
      closeLabel={t("common.actions.close")}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {transactionId ? (
          <div role="group" aria-label={t("transactions.form.type")} className="flex gap-2">
            {(["expense", "income", "transfer"] as const).map((tp) => (
              <Button
                key={tp}
                type="button"
                size="sm"
                variant={type === tp ? "default" : "outline"}
                aria-pressed={type === tp}
                onClick={() => changeType(tp)}
              >
                {t(`transactions.list.type.${tp}`)}
              </Button>
            ))}
          </div>
        ) : null}

        {type === "transfer" ? (
          <>
        <label className="block text-sm font-medium">
          {t("transactions.transfers.form.fromAccount")}
          <Controller
            control={control}
            name="from_account_id"
            render={({ field }) => (
              <Select className="mt-1" {...field}>
                <option value="">{t("transactions.form.selectPlaceholder")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          />
          {errors.from_account_id ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.from_account_id.message}</p> : null}
        </label>
        <label className="block text-sm font-medium">
          {t("transactions.transfers.form.toAccount")}
          <Controller
            control={control}
            name="to_account_id"
            render={({ field }) => (
              <Select className="mt-1" {...field}>
                <option value="">{t("transactions.form.selectPlaceholder")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          />
          {errors.to_account_id ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.to_account_id.message}</p> : null}
        </label>
          </>
        ) : (
        <label className="block text-sm font-medium">
          {t("transactions.form.account")}
          <Controller
            control={control}
            name="account_id"
            render={({ field }) => (
              <Select className="mt-1" {...field}>
                <option value="">{t("transactions.form.selectPlaceholder")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            )}
          />
          {errors.account_id ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.account_id.message}</p> : null}
        </label>
        )}

        <label className="block text-sm font-medium">
          {t("transactions.form.amount")}
          <Input
            className="mt-1"
            placeholder={t("transactions.form.amountPlaceholder")}
            type="text"
            inputMode="decimal"
            {...register("amount")}
          />
          {errors.amount ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.amount.message}</p> : null}
        </label>

        <label className="block text-sm font-medium">
          {t("transactions.form.date")}
          <Input className="mt-1" type="date" {...register("date")} />
          {errors.date ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.date.message}</p> : null}
        </label>

        <label className="block text-sm font-medium">
          {t("transactions.form.description")}
          <Input className="mt-1" {...register("description")} />
          {errors.description ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.description.message}</p> : null}
        </label>

        {type !== "transfer" ? (
        <>
        <label className="block text-sm font-medium">
          {t("transactions.form.category")}
          <Controller
            control={control}
            name="category_id"
            render={({ field }) => (
              <Select className="mt-1" {...field}>
                <option value="">{t("transactions.form.noCategoryOption")}</option>
                {typeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon ? `${c.icon} ` : ""}
                    {resolveCategoryName(c, t)}
                  </option>
                ))}
              </Select>
            )}
          />
        </label>
        {errors.category_id ? <p className="-mt-3 text-xs text-red-600 dark:text-red-400">{errors.category_id.message}</p> : null}
        </>
        ) : null}

        <label className="block text-sm font-medium">
          {t("transactions.form.notes")}
          <textarea
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
            rows={2}
            {...register("notes")}
          />
        </label>

        {confirmingMirrorDelete ? (
          <p role="alert" className="rounded-md border border-border bg-muted p-3 text-sm">
            {t("transactions.form.confirmLeaveTransfer")}
          </p>
        ) : null}

        {ruleMessage ? (
          <p role="status" className="text-sm text-muted-foreground">
            {ruleMessage}
          </p>
        ) : null}

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" disabled={isSubmitting || ruleMessage !== null}>
            {isSubmitting
              ? t("common.state.saving")
              : confirmingMirrorDelete
                ? t("transactions.form.confirmLeaveTransferAction")
                : transactionId
                  ? t("common.actions.update")
                  : t("common.actions.create")}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
