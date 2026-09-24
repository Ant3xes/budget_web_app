import { NextResponse } from "next/server";
import { z } from "zod";

import { withSpace } from "@/lib/spaces/with-space";

const patchSchema = z.object({ default_share_percent: z.number().int().min(0).max(100) });

/** Updates the default payer share of a shared space. Owner only. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!z.guid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid space id" }, { status: 400 });
  }

  const payload = patchSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  // RLS filters non-owners out silently, so check the row count.
  const { data, error } = await auth.supabase
    .from("spaces")
    .update({ default_share_percent: payload.data.default_share_percent })
    .eq("id", id)
    .select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}

/** Deletes a shared space and everything in it. Owner only; personal spaces cannot be deleted. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!z.guid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid space id" }, { status: 400 });
  }

  // RLS filters non-owners / personal spaces out silently, so check the row count.
  const { data, error } = await auth.supabase.from("spaces").delete().eq("id", id).select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data?.length) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true });
}
