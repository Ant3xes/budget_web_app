import Link from "next/link";

import { LogoMark } from "@/components/brand/logo";
import { T } from "@/components/i18n/t";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

/**
 * Custom 404, replacing Next.js's generic default (issue #91). Same shell as
 * the public auth pages (app/(auth)/login/page.tsx) so it stays on-brand
 * instead of the framework's bare page. The back link goes to /dashboard for
 * a signed-in visitor, /login otherwise — mirrors app/invite/[token]/page.tsx,
 * which already branches the same way for a stale/invalid link.
 */
export default async function NotFound() {
  let authenticated = false;
  if (hasSupabaseConfig) {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = Boolean(user);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-4 py-8 text-center pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-center gap-2.5">
        <LogoMark />
        <span className="text-base font-semibold tracking-tight">
          <T k="nav.appTitle" />
        </span>
      </div>
      <section className="w-full rounded-xl border border-border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold">
          <T k="common.notFound.title" />
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          <T k="common.notFound.description" />
        </p>
        <Link
          href={authenticated ? "/dashboard" : "/login"}
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 md:h-9"
        >
          <T k={authenticated ? "common.notFound.backAuthenticated" : "common.notFound.backAnonymous"} />
        </Link>
      </section>
    </main>
  );
}
