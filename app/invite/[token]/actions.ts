"use server";

import { redirect } from "next/navigation";

import { setActiveSpaceCookie } from "@/lib/spaces/active-cookie";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Joins the space behind an invitation token, then opens it. Explicit action
 * (a button on the invite page) rather than a side effect of loading the
 * page, so link previews / prefetchers cannot consume the invitation.
 */
export async function acceptInvitation(token: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${encodeURIComponent(token)}`)}`);
  }

  const { data: spaceId, error } = await supabase.rpc("accept_space_invitation", { p_token: token });

  if (error || typeof spaceId !== "string") {
    redirect(`/invite/${encodeURIComponent(token)}?error=1`);
  }

  await setActiveSpaceCookie(spaceId);
  redirect("/dashboard");
}
