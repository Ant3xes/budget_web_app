import Link from "next/link";
import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LogoMark } from "@/components/brand/logo";
import { T } from "@/components/i18n/t";

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
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-center gap-2.5">
        <LogoMark />
        <span className="text-base font-semibold tracking-tight">
          <T k="nav.appTitle" />
        </span>
      </div>
        <p className="rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm">
          <T k="invitations.accept.notFound" />
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-center gap-2.5">
        <LogoMark />
        <span className="text-base font-semibold tracking-tight">
          <T k="nav.appTitle" />
        </span>
      </div>
        <p className="rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm">
          <T k="invitations.accept.signInPrompt" />
        </p>
        <div className="flex gap-3">
          <Link href="/login" className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground md:h-9 md:flex-none">
            <T k="invitations.accept.signIn" />
          </Link>
          <Link href="/signup" className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-border px-4 text-sm text-foreground md:h-9 md:flex-none">
            <T k="invitations.accept.signUp" />
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
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="flex items-center justify-center gap-2.5">
        <LogoMark />
        <span className="text-base font-semibold tracking-tight">
          <T k="nav.appTitle" />
        </span>
      </div>
      <p className="rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm">
        <T k="invitations.accept.success" />
      </p>
      <Link href="/dashboard" className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground md:h-9">
        <T k="invitations.accept.goToDashboard" />
      </Link>
    </main>
  );
}
