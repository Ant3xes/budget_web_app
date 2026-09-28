"use client";

import { useLocale } from "@/components/locale-provider";

/**
 * Renders the login/signup pages' `?message=` query param. `(auth)/
 * actions.ts` can't call `useLocale()` (a Server Action has no React
 * context, and locale is client-only/localStorage per this app's i18n
 * design), so it redirects with sentinels like `"signupSuccess"` or
 * `"rateLimited"` instead of a literal sentence — resolved here via `t()`.
 * Any other value is Supabase Auth's own error text (e.g. "Invalid login
 * credentials"), shown as-is: it comes from the auth library, not this app,
 * so it isn't in the dictionary and can't be translated here.
 */
const MESSAGE_KEYS: Record<string, string> = {
  signupSuccess: "auth.signupSuccessMessage",
  rateLimited: "auth.rateLimitedMessage",
};

export function AuthMessage({ message }: { message?: string }) {
  const { t } = useLocale();
  if (!message) return null;
  const key = MESSAGE_KEYS[message];
  const text = key ? t(key) : message;
  return <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-400">{text}</p>;
}
