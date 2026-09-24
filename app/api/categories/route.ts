import { NextResponse } from "next/server";
import { z } from "zod";

import { withSpace } from "@/lib/spaces/with-space";

const categorySchema = z.object({
  name: z.string().trim().min(1).max(80),
  kind: z.enum(["expense", "income", "transfer"]),
  color: z.string().trim().max(20).optional().nullable(),
  icon: z.string().trim().max(10).optional().nullable(),
});

export async function GET() {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("categories")
    .select("id, name, kind, color, icon, is_default, translation_key")
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .order("kind")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ categories: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = categorySchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("categories").insert({
    space_id: auth.spaceId,
    user_id: auth.user.id,
    name: payload.data.name,
    kind: payload.data.kind,
    color: payload.data.color ?? null,
    icon: payload.data.icon ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
