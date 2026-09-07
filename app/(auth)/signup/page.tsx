import Link from "next/link";

import { AuthMessage } from "@/components/auth-message";
import { T } from "@/components/i18n/t";
import { hasSupabaseConfig } from "@/lib/supabase/config";

import { signup } from "../actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <section className="w-full rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold dark:text-zinc-100">
          <T k="auth.signup.title" />
        </h1>
        {!hasSupabaseConfig ? (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
            <T k="auth.configWarning" />
          </p>
        ) : (
          <form action={signup} className="mt-6 space-y-4">
            <label className="block text-sm font-medium dark:text-zinc-300">
              <T k="auth.emailLabel" />
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                name="email"
                type="email"
                required
              />
            </label>
            <label className="block text-sm font-medium dark:text-zinc-300">
              <T k="auth.passwordLabel" />
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </label>
            <button
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              type="submit"
            >
              <T k="auth.signup.submit" />
            </button>
          </form>
        )}
        <AuthMessage message={params.message} />
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          <T k="auth.signup.alreadyRegistered" />{" "}
          <Link href="/login" className="underline dark:text-zinc-300">
            <T k="auth.signup.signIn" />
          </Link>
        </p>
      </section>
    </main>
  );
}
