import { InviteForm } from "@/components/invitations/invite-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { T } from "@/components/i18n/t";
import { InvitationStatusLabel } from "@/components/invitations/invitation-status-label";
import { Card } from "@/components/ui/card";

export default async function InvitationsPage() {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("invitations")
    .select("id, invitee_email, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">
        <T k="invitations.title" />
      </h1>
      <Card className="max-w-md p-4">
        <h2 className="text-lg font-medium">
          <T k="invitations.invite.heading" />
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <T k="invitations.invite.description" />
        </p>
        <div className="mt-3">
          <InviteForm />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-lg font-medium">
          <T k="invitations.recent.heading" />
        </h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(data ?? []).map((invite) => (
            <li key={invite.id} className="flex items-center justify-between rounded-lg border border-border p-2">
              <span>{invite.invitee_email}</span>
              <span className="capitalize text-muted-foreground">
                <InvitationStatusLabel status={invite.status} />
              </span>
            </li>
          ))}
          {!data?.length ? (
            <li className="text-muted-foreground">
              <T k="invitations.recent.empty" />
            </li>
          ) : null}
        </ul>
      </Card>
    </section>
  );
}
