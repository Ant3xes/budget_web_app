import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function InvitationAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, status")
    .eq("token", token)
    .maybeSingle();

  if (!invitation) {
    return (
      <main className="mx-auto max-w-md p-6">
        <p className="rounded-md bg-white p-4 shadow-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">This invitation does not exist.</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md p-6 space-y-4">
        <p className="rounded-md bg-white p-4 shadow-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">Sign in or create an account to accept the invitation.</p>
        <div className="flex gap-3">
          <Link href="/login" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900">
            Sign in
          </Link>
          <Link href="/signup" className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
            Sign up
          </Link>
        </div>
      </main>
    );
  }

  if (invitation.status === "accepted") {
    redirect("/dashboard");
  }

  await supabase
    .from("invitations")
    .update({ status: "accepted", accepted_by_user_id: user.id, accepted_at: new Date().toISOString() })
    .eq("id", invitation.id);

  return (
    <main className="mx-auto max-w-md p-6">
      <p className="rounded-md bg-white p-4 shadow-sm text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">Invitation accepted. Your personal space is now ready.</p>
      <Link href="/dashboard" className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900">
        Go to dashboard
      </Link>
    </main>
  );
}
