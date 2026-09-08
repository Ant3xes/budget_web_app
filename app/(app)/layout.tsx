import Link from "next/link";
import { redirect } from "next/navigation";

import { TopNav } from "@/components/layout/top-nav";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div>
      <TopNav userEmail={user.email ?? ""} />
      {/* Single source of page padding — pages below only ever add
          `space-y-4` for their own vertical rhythm, never their own p-*
          (previously duplicated inconsistently: some added p-6 on top of
          this, accounts used space-y-6 instead of space-y-4). */}
      <main className="p-4 md:p-6">{children}</main>
      <footer className="border-t border-border px-4 py-3 text-xs text-muted-foreground md:px-6">
        <Link href="/plan" className="underline underline-offset-2 hover:text-foreground">
          Plan
        </Link>
      </footer>
    </div>
  );
}
