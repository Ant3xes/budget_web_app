import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = inviteSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { count } = await supabase
    .from("invitations")
    .select("id", { count: "exact", head: true })
    .eq("inviter_user_id", user.id)
    .in("status", ["pending", "accepted"]);

  if ((count ?? 0) >= 5) {
    return NextResponse.json({ error: "You can invite up to 5 friends." }, { status: 400 });
  }

  const token = randomUUID();
  const { error } = await supabase.from("invitations").insert({
    inviter_user_id: user.id,
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
