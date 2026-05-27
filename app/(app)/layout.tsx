import { redirect } from "next/navigation";

import { logout } from "@/app/(auth)/actions";
import { Sidebar } from "@/components/layout/sidebar";
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
    <div className="md:flex">
      <Sidebar />
      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
          <p className="text-sm text-zinc-600">{user.email}</p>
          <form action={logout}>
            <button className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm" type="submit">
              Logout
            </button>
          </form>
        </header>
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}
