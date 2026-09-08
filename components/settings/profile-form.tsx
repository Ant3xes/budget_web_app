"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ProfileFormProps {
  initialFullName: string;
}

export function ProfileForm({ initialFullName }: ProfileFormProps) {
  const router = useRouter();
  const { t } = useLocale();
  const [nameError, setNameError] = useState<string | null>(null);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Validation messages need the current `t`, so the schemas are built
  // inside the component (memoized on the locale) rather than at module
  // scope.
  const nameSchema = useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(1, t("profile.info.nameRequired")).max(100),
      }),
    [t],
  );

  const passwordSchema = useMemo(
    () =>
      z
        .object({
          current_password: z.string().min(6, t("profile.security.currentPasswordRequired")),
          new_password: z.string().min(8, t("profile.security.newPasswordMin")),
          confirm: z.string(),
        })
        .refine((data) => data.confirm === data.new_password, {
          message: t("profile.security.passwordMismatch"),
          path: ["confirm"],
        }),
    [t],
  );

  type NameFormValues = z.infer<typeof nameSchema>;
  type PasswordFormValues = z.infer<typeof passwordSchema>;

  const nameForm = useForm<NameFormValues>({
    resolver: zodResolver(nameSchema),
    defaultValues: { full_name: initialFullName },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      confirm: "",
    },
  });

  const onNameSubmit = nameForm.handleSubmit(async (values) => {
    setNameError(null);
    setNameSuccess(false);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: values.full_name }),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setNameError(result.error ?? t("profile.info.saveError"));
      return;
    }

    setNameSuccess(true);
    router.refresh();
  });

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    setPasswordError(null);
    setPasswordSuccess(false);

    const response = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const result = (await response.json()) as { error?: string };
      setPasswordError(result.error ?? t("profile.security.changeError"));
      return;
    }

    passwordForm.reset();
    setPasswordSuccess(true);
  });

  return (
    <Card>
      <CardContent className="space-y-8">
        <section className="max-w-md space-y-4">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{t("profile.info.heading")}</h2>
          <form onSubmit={onNameSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("profile.info.nameLabel")}
              <Input
                className="mt-1"
                {...nameForm.register("full_name")}
                data-testid="profile-full-name"
              />
              {nameForm.formState.errors.full_name ? (
                <p className="mt-1 text-xs text-red-600">
                  {nameForm.formState.errors.full_name.message}
                </p>
              ) : null}
            </label>

            {nameError ? <p className="text-sm text-red-600">{nameError}</p> : null}
            {nameSuccess ? (
              <p className="text-sm text-green-600 dark:text-green-400">{t("profile.info.updateSuccess")}</p>
            ) : null}

            <Button type="submit" variant="default" disabled={nameForm.formState.isSubmitting}>
              {nameForm.formState.isSubmitting ? t("common.state.saving") : t("common.actions.save")}
            </Button>
          </form>
        </section>

        <section className="max-w-md space-y-4 border-t border-zinc-200 pt-8 dark:border-zinc-700">
          <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">{t("profile.security.heading")}</h2>
          <form onSubmit={onPasswordSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("profile.security.currentPasswordLabel")}
              <Input
                type="password"
                autoComplete="current-password"
                className="mt-1"
                {...passwordForm.register("current_password")}
              />
              {passwordForm.formState.errors.current_password ? (
                <p className="mt-1 text-xs text-red-600">
                  {passwordForm.formState.errors.current_password.message}
                </p>
              ) : null}
            </label>

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("profile.security.newPasswordLabel")}
              <Input
                type="password"
                autoComplete="new-password"
                className="mt-1"
                {...passwordForm.register("new_password")}
              />
              {passwordForm.formState.errors.new_password ? (
                <p className="mt-1 text-xs text-red-600">
                  {passwordForm.formState.errors.new_password.message}
                </p>
              ) : null}
            </label>

            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t("profile.security.confirmPasswordLabel")}
              <Input
                type="password"
                autoComplete="new-password"
                className="mt-1"
                {...passwordForm.register("confirm")}
              />
              {passwordForm.formState.errors.confirm ? (
                <p className="mt-1 text-xs text-red-600">
                  {passwordForm.formState.errors.confirm.message}
                </p>
              ) : null}
            </label>

            {passwordError ? <p className="text-sm text-red-600">{passwordError}</p> : null}
            {passwordSuccess ? (
              <p className="text-sm text-green-600 dark:text-green-400">
                {t("profile.security.updateSuccess")}
              </p>
            ) : null}

            <Button type="submit" variant="default" disabled={passwordForm.formState.isSubmitting}>
              {passwordForm.formState.isSubmitting ? t("common.state.saving") : t("profile.security.submit")}
            </Button>
          </form>
        </section>
      </CardContent>
    </Card>
  );
}
