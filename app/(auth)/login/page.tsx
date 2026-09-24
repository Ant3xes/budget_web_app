import Link from "next/link";

import { AuthMessage } from "@/components/auth-message";
import { LogoMark } from "@/components/brand/logo";
import { T } from "@/components/i18n/t";
import { hasSupabaseConfig } from "@/lib/supabase/config";

import { login } from "../actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-center gap-2.5">
        <LogoMark />
        <span className="text-base font-semibold tracking-tight">
          <T k="nav.appTitle" />
        </span>
      </div>
      <section className="w-full rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold">
          <T k="auth.login.title" />
        </h1>
        {!hasSupabaseConfig ? (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">
            <T k="auth.configWarning" />
          </p>
        ) : (
          <form action={login} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              <T k="auth.emailLabel" />
              <input
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground md:h-9 md:text-sm"
                name="email"
                type="email"
                required
              />
            </label>
            <label className="block text-sm font-medium">
              <T k="auth.passwordLabel" />
              <input
                className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground md:h-9 md:text-sm"
                name="password"
                type="password"
                minLength={8}
                required
              />
            </label>
            <button
              className="h-11 w-full rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 md:h-9"
              type="submit"
            >
              <T k="auth.login.submit" />
            </button>
          </form>
        )}
        <AuthMessage message={params.message} />
        <p className="mt-4 text-sm text-muted-foreground">
          <T k="auth.login.noAccount" />{" "}
          <Link href="/signup" className="underline">
            <T k="auth.login.createOne" />
          </Link>
        </p>
      </section>
    </main>
  );
}
