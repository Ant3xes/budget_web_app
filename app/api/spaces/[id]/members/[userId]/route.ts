import { NextResponse } from "next/server";
import { z } from "zod";

import { withSpace } from "@/lib/spaces/with-space";

/**
 * Leaves a space (userId = caller) or, for the owner, removes another member.
 * The owner cannot leave — they delete the space instead. Rows the member
 * authored stay in the space.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, userId } = await params;
  const ids = z.object({ id: z.guid(), userId: z.guid() }).safeParse({ id, userId });
  if (!ids.success) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  // RLS (space_members_delete) only lets a non-owner remove themselves, or the
  // owner remove someone else; anything else matches zero rows.
  const { data, error } = await auth.supabase
    .from("space_members")
    .delete()
    .eq("space_id", ids.data.id)
    .eq("user_id", ids.data.userId)
    .select("user_id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
