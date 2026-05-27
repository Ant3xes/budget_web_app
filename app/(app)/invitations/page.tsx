import { InviteForm } from "@/components/invitations/invite-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function InvitationsPage() {
  const supabase = await createServerSupabaseClient();

  const { data } = await supabase
    .from("invitations")
    .select("id, invitee_email, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Invitations</h1>
      <article className="max-w-md rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">Invite 2-5 friends</h2>
        <p className="mt-1 text-sm text-zinc-600">Each invited user keeps an independent private space.</p>
        <div className="mt-3">
          <InviteForm />
        </div>
      </article>

      <article className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">Recent invitations</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(data ?? []).map((invite) => (
            <li key={invite.id} className="flex items-center justify-between rounded-md border border-zinc-200 p-2">
              <span>{invite.invitee_email}</span>
              <span className="capitalize text-zinc-600">{invite.status}</span>
            </li>
          ))}
          {!data?.length ? <li className="text-zinc-500">No invitations yet.</li> : null}
        </ul>
      </article>
    </section>
  );
}
