import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { withSpace } from "@/lib/spaces/with-space";

const inviteSchema = z.object({
  email: z.string().email(),
});

const MAX_PENDING_INVITATIONS = 10;

/** Invites someone into the active (shared) space. Returns the link to send them. */
export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (auth.space.kind !== "shared") {
    return NextResponse.json({ error: "Personal spaces cannot be shared." }, { status: 400 });
  }

  const payload = inviteSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { count } = await auth.supabase
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("space_id", auth.spaceId)
    .eq("status", "pending");

  if ((count ?? 0) >= MAX_PENDING_INVITATIONS) {
    return NextResponse.json({ error: "Too many pending invitations for this space." }, { status: 400 });
  }

  const token = randomUUID();
  const { error } = await auth.supabase.from("invitations").insert({
    inviter_user_id: auth.user.id,
    space_id: auth.spaceId,
    invitee_email: payload.data.email,
    token,
    status: "pending",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const inviteLink = `${baseUrl}/invite/${token}`;

  return NextResponse.json({ inviteLink });
}
