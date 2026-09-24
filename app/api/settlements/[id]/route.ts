import { NextResponse } from "next/server";
import { z } from "zod";

import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";

/** Removes a settlement. Creator only (RLS). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.guid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid settlement id" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("settlements")
    .delete()
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .select("id");
  if (error) return pgErrorResponse(error);
  if (!data?.length) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json({ ok: true });
}
