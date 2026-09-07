"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale } from "@/components/locale-provider";

export function InviteForm() {
  const router = useRouter();
  const { t } = useLocale();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Validation message needs the current `t`, so the schema is built inside
  // the component (memoized on the locale) rather than at module scope.
  const inviteSchema = useMemo(
    () =>
      z.object({
        email: z.string().email(t("invitations.invite.emailInvalid")),
      }),
    [t],
  );

  type InviteValues = z.infer<typeof inviteSchema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteValues>({ resolver: zodResolver(inviteSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setSuccess(null);

    const response = await fetch("/api/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as { error?: string; inviteLink?: string };

    if (!response.ok) {
      setError(result.error ?? t("invitations.invite.createError"));
      return;
    }

    setSuccess(t("invitations.invite.createdSuccess", { link: result.inviteLink ?? "" }));
    reset({ email: "" });
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        {t("invitations.invite.emailLabel")}
        <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" {...register("email")} />
      </label>
      {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700 break-all">{success}</p> : null}
      <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={isSubmitting} type="submit">
        {t("invitations.invite.submit")}
      </button>
    </form>
  );
}
