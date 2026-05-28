"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ACCOUNT_TYPES } from "@/lib/constants";

const accountSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  type: z.enum(ACCOUNT_TYPES),
  initialBalanceCents: z.number().int(),
  currency: z.string().length(3),
});

type AccountFormValues = z.infer<typeof accountSchema>;

interface AccountFormProps {
  accountId?: string;
  defaultValues?: AccountFormValues;
}

export function AccountForm({ accountId, defaultValues }: AccountFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: defaultValues ?? {
      name: "",
      type: "courant",
      initialBalanceCents: 0,
      currency: "EUR",
    },
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
      setError(result.error ?? "Unable to save account");
      return;
    }

    router.push("/accounts");
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        Name
        <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" {...register("name")} />
        {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name.message}</p> : null}
      </label>

      <label className="block text-sm font-medium">
        Type
        <select className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" {...register("type")}>
          {ACCOUNT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium">
        Initial balance (cents)
        <input
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          type="number"
          {...register("initialBalanceCents", { valueAsNumber: true })}
        />
      </label>

      <label className="block text-sm font-medium">
        Currency
        <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" maxLength={3} {...register("currency")} />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        disabled={isSubmitting}
        type="submit"
      >
        {accountId ? "Update account" : "Create account"}
      </button>
    </form>
  );
}
