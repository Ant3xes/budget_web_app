import { NextResponse } from "next/server";
import { z } from "zod";

import { withSpace } from "@/lib/spaces/with-space";

/** Categories of a space the caller belongs to (used to pick the common category when sharing). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!z.guid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid space id" }, { status: 400 });
  }
  if (!auth.spaces.some((space) => space.id === id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await auth.supabase
    .from("categories")
    .select("id, name, kind, color, icon, is_default, translation_key")
    .eq("space_id", id)
    .is("deleted_at", null)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ categories: data ?? [] });
}
