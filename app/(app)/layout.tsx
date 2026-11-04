import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { T } from "@/components/i18n/t";
import { DemoProvider } from "@/components/demo-provider";
import { DemoBanner } from "@/components/layout/demo-banner";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SIDEBAR_COOKIE } from "@/components/layout/nav-utils";
import { Sidebar } from "@/components/layout/sidebar";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { getSpaceContext } from "@/lib/spaces/context";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  if (!hasSupabaseConfig) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Supabase configuration missing</h1>
        <p className="mt-2 text-sm text-zinc-700">
          Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to use the app.
        </p>
      </main>
    );
  }

  const context = await getSpaceContext();

  if (!context) {
    redirect("/login");
  }

  const { user, spaces, spaceId } = context;

  const sidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    <DemoProvider isDemo={context.isDemo}>
    <div className="md:flex">
      {/* WCAG 2.4.1: first focusable element, visible only on keyboard focus. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        <T k="common.skipToContent" />
      </a>
      {/* Desktop : sidebar sticky à gauche. Mobile : barre du haut (logo) + barre du bas fixe. */}
      <Sidebar userEmail={user.email ?? ""} defaultCollapsed={sidebarCollapsed} spaces={spaces} activeSpaceId={spaceId} />
      <BottomNav userEmail={user.email ?? ""} spaces={spaces} activeSpaceId={spaceId} />
      <div className="min-w-0 flex-1">
        <DemoBanner isDemo={context.isDemo} />
        {/* Single source of page padding — pages below only ever add
            `space-y-4` for their own vertical rhythm, never their own p-*.
            `pb-28` réserve la place de la barre du bas fixe sur mobile. */}
        <main id="main-content" tabIndex={-1} className="p-4 pb-28 outline-none md:p-6 md:pb-6">{children}</main>
        <footer className="hidden border-t border-border px-4 py-3 text-xs text-muted-foreground md:block md:px-6">
          <Link href="/plan" className="underline underline-offset-2 hover:text-foreground">
            Plan
          </Link>{" "}
          ·{" "}
          <Link href="/cgu" className="underline underline-offset-2 hover:text-foreground">
            CGU
          </Link>{" "}
          ·{" "}
          <Link href="/rgpd" className="underline underline-offset-2 hover:text-foreground">
            Confidentialité
          </Link>
        </footer>
      </div>
    </div>
    </DemoProvider>
  );
}
