"use client";

import { useLocale } from "@/components/locale-provider";

/**
 * Renders the login/signup pages' `?message=` query param. `(auth)/
 * actions.ts` can't call `useLocale()` (a Server Action has no React
 * context, and locale is client-only/localStorage per this app's i18n
 * design), so it redirects with sentinels like `"signupSuccess"` or
 * `"rateLimited"` instead of a literal sentence — resolved here via `t()`.
 * Any other value is ignored: the query string is attacker-controllable
 * (a crafted link must not be able to display arbitrary text on the login
 * page), so only the sentinels below are ever rendered.
 */
const MESSAGE_KEYS: Record<string, string> = {
  demoUnavailable: "auth.demoUnavailableMessage",
  demoMisconfigured: "auth.demoMisconfiguredMessage",
  signupSuccess: "auth.signupSuccessMessage",
  rateLimited: "auth.rateLimitedMessage",
  invalidCredentials: "auth.invalidCredentialsMessage",
  emailNotConfirmed: "auth.emailNotConfirmedMessage",
  signupFailed: "auth.signupFailedMessage",
};

/** Sentinels announced as a status (success/info); the others are errors (role="alert"). */
const STATUS_MESSAGES = new Set(["signupSuccess"]);

export function AuthMessage({ message }: { message?: string }) {
  const { t } = useLocale();
  const key = message && Object.hasOwn(MESSAGE_KEYS, message) ? MESSAGE_KEYS[message] : undefined;
  if (!message || !key) return null;
  // WCAG 4.1.3: the message appears after a redirect, so assistive technology
  // must be told about it (alert for errors, status for confirmations).
  const isStatus = STATUS_MESSAGES.has(message);
  return (
    <p role={isStatus ? "status" : "alert"} className="mt-4 text-sm text-zinc-700 dark:text-zinc-400">
      {t(key)}
    </p>
  );
}
