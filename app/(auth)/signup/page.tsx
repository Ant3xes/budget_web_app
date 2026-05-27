import Link from "next/link";

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
      <section className="w-full rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create account</h1>
        {!hasSupabaseConfig ? (
          <p className="mt-4 text-sm text-amber-700">
            Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable auth.
          </p>
        ) : (
          <form action={signup} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Email
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
                name="email"
                type="email"
                required
              />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </label>
            <button
              className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white"
              type="submit"
            >
              Create account
            </button>
          </form>
        )}
        {params.message ? <p className="mt-4 text-sm text-zinc-700">{params.message}</p> : null}
        <p className="mt-4 text-sm text-zinc-600">
          Already registered? <Link href="/login" className="underline">Sign in</Link>
        </p>
      </section>
    </main>
  );
}
