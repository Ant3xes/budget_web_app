import { T } from "@/components/i18n/t";
import { InvitationStatusLabel } from "@/components/invitations/invitation-status-label";
import { InviteForm } from "@/components/invitations/invite-form";
import { CreateSpaceForm } from "@/components/spaces/create-space-form";
import { RevokeInvitationButton } from "@/components/spaces/revoke-invitation-button";
import { SpaceActionButton } from "@/components/spaces/space-action-button";
import { Card } from "@/components/ui/card";
import { requireSpaceContext } from "@/lib/spaces/context";

type MemberRow = {
  user_id: string;
  role: "owner" | "member";
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};

export default async function SharingPage() {
  const { supabase, user, space, spaceId } = await requireSpaceContext();
  const isShared = space.kind === "shared";
  const isOwner = space.role === "owner";

  const [{ data: memberRows }, { data: invitations }] = isShared
    ? await Promise.all([
        supabase.from("space_members").select("user_id, role, profiles(full_name)").eq("space_id", spaceId),
        supabase
          .from("invitations")
          .select("id, invitee_email, status, created_at")
          .eq("space_id", spaceId)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  const members = ((memberRows ?? []) as MemberRow[]).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return { userId: row.user_id, role: row.role, name: profile?.full_name ?? "?" };
  });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">
        <T k="invitations.title" />
      </h1>

      <Card className="p-4">
        <h2 className="text-lg font-medium">
          {isShared ? (
            <T k="invitations.current.heading" vars={{ space: space.name }} />
          ) : (
            <T k="invitations.current.headingPersonal" />
          )}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <T k={isShared ? "invitations.current.sharedDescription" : "invitations.current.personalDescription"} />
        </p>
      </Card>

      {!isShared ? (
        <Card className="max-w-md p-4">
          <h2 className="text-lg font-medium">
            <T k="invitations.create.heading" />
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <T k="invitations.create.description" />
          </p>
          <div className="mt-3">
            <CreateSpaceForm />
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <h2 className="text-lg font-medium">
              <T k="invitations.members.heading" />
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
                >
                  <span className="min-w-0 truncate">
                    {member.name}
                    {member.userId === user.id ? (
                      <span className="ml-1 text-muted-foreground">
                        (<T k="invitations.members.you" />)
                      </span>
                    ) : null}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-muted-foreground">
                      <T k={member.role === "owner" ? "invitations.members.owner" : "invitations.members.member"} />
                    </span>
                    {isOwner && member.userId !== user.id ? (
                      <SpaceActionButton
                        size="xs"
                        url={`/api/spaces/${spaceId}/members/${member.userId}`}
                        labelKey="invitations.members.remove"
                        confirmTitleKey="invitations.members.removeConfirmTitle"
                        confirmDescriptionKey="invitations.members.removeConfirmDescription"
                      />
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Card>

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
              {(invitations ?? []).map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-2"
                >
                  <span className="min-w-0 truncate">{invite.invitee_email}</span>
                  <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                    <InvitationStatusLabel status={invite.status} />
                    {invite.status === "pending" ? <RevokeInvitationButton invitationId={invite.id} /> : null}
                  </span>
                </li>
              ))}
              {!invitations?.length ? (
                <li className="text-muted-foreground">
                  <T k="invitations.recent.empty" />
                </li>
              ) : null}
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="text-lg font-medium">
              <T k="invitations.danger.heading" />
            </h2>
            <div className="mt-3">
              {isOwner ? (
                <SpaceActionButton
                  url={`/api/spaces/${spaceId}`}
                  labelKey="invitations.danger.delete"
                  confirmTitleKey="invitations.danger.deleteConfirmTitle"
                  confirmDescriptionKey="invitations.danger.deleteConfirmDescription"
                />
              ) : (
                <SpaceActionButton
                  url={`/api/spaces/${spaceId}/members/${user.id}`}
                  labelKey="invitations.danger.leave"
                  confirmTitleKey="invitations.danger.leaveConfirmTitle"
                  confirmDescriptionKey="invitations.danger.leaveConfirmDescription"
                />
              )}
            </div>
          </Card>
        </>
      )}
    </section>
  );
}
