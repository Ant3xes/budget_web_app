import Link from "next/link";

import { hasSupabaseConfig } from "@/lib/supabase/config";

import { login } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4">
      <section className="w-full rounded-xl bg-white p-6 shadow-sm dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-zinc-800">
        <h1 className="text-2xl font-semibold dark:text-zinc-100">Sign in</h1>
        {!hasSupabaseConfig ? (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
            Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable auth.
          </p>
        ) : (
          <form action={login} className="mt-6 space-y-4">
            <label className="block text-sm font-medium dark:text-zinc-300">
              Email
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                name="email"
                type="email"
                required
              />
            </label>
            <label className="block text-sm font-medium dark:text-zinc-300">
              Password
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
              Sign in
            </button>
          </form>
        )}
        {params.message ? <p className="mt-4 text-sm text-zinc-700 dark:text-zinc-400">{params.message}</p> : null}
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
          No account? <Link href="/signup" className="underline dark:text-zinc-300">Create one</Link>
        </p>
      </section>
    </main>
  );
}
