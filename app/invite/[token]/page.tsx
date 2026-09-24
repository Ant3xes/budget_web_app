import Link from "next/link";

import { acceptInvitation } from "@/app/invite/[token]/actions";
import { LogoMark } from "@/components/brand/logo";
import { T } from "@/components/i18n/t";
import { Button } from "@/components/ui/button";
import { nextQuery } from "@/lib/auth/safe-next";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const shellClass =
  "mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))]";
const cardClass = "rounded-md border border-border bg-card p-4 text-card-foreground shadow-sm";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className={shellClass}>
      <div className="flex items-center justify-center gap-2.5">
        <LogoMark />
        <span className="text-base font-semibold tracking-tight">
          <T k="nav.appTitle" />
        </span>
      </div>
      {children}
    </main>
  );
}

export default async function InvitationAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const inviteHref = `/invite/${encodeURIComponent(token)}`;
  const { data } = await supabase.rpc("get_space_invitation", { p_token: token });
  const invitation = data?.[0];

  if (!invitation) {
    return (
      <Shell>
        <p className={cardClass}>
          <T k="invitations.accept.notFound" />
        </p>
      </Shell>
    );
  }

  if (invitation.status !== "pending" || invitation.expired) {
    return (
      <Shell>
        <p className={cardClass}>
          <T k="invitations.accept.unavailable" />
        </p>
        <Link
          href="/dashboard"
          className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground md:h-9"
        >
          <T k="invitations.accept.goToDashboard" />
        </Link>
      </Shell>
    );
  }

  const summary = (
    <p className={cardClass}>
      <T
        k="invitations.accept.summary"
        vars={{ inviter: invitation.inviter_name ?? "?", space: invitation.space_name }}
      />
    </p>
  );

  if (!user) {
    return (
      <Shell>
        {summary}
        <p className={cardClass}>
          <T k="invitations.accept.signInPrompt" />
        </p>
        <div className="flex gap-3">
          <Link href={`/login${nextQuery(inviteHref)}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-md bg-primary px-4 text-sm text-primary-foreground md:h-9 md:flex-none">
            <T k="invitations.accept.signIn" />
          </Link>
          <Link href={`/signup${nextQuery(inviteHref)}`} className="inline-flex h-11 flex-1 items-center justify-center rounded-md border border-border px-4 text-sm text-foreground md:h-9 md:flex-none">
            <T k="invitations.accept.signUp" />
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {summary}
      {error ? (
        <p className="text-sm text-red-600">
          <T k="invitations.accept.error" />
        </p>
      ) : null}
      <form action={acceptInvitation.bind(null, token)}>
        <Button type="submit" className="h-11 w-full md:h-9">
          <T k="invitations.accept.join" />
        </Button>
      </form>
    </Shell>
  );
}
