"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email("A valid email is required"),
});

type InviteValues = z.infer<typeof inviteSchema>;

export function InviteForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      setError(result.error ?? "Unable to create invitation");
      return;
    }

    setSuccess(`Invitation created: ${result.inviteLink}`);
    reset({ email: "" });
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label className="block text-sm font-medium">
        Friend email
        <input className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" {...register("email")} />
      </label>
      {errors.email ? <p className="text-xs text-red-600">{errors.email.message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-700 break-all">{success}</p> : null}
      <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50" disabled={isSubmitting} type="submit">
        Send invitation
      </button>
    </form>
  );
}
