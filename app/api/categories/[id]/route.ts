import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  kind: z.enum(["expense", "income", "transfer"]).optional(),
  color: z.string().trim().max(20).optional().nullable(),
  icon: z.string().trim().max(10).optional().nullable(),
});

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const payload = categoryUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  // Renaming a default (seeded) category must stop it from following the
  // locale — otherwise resolveCategoryName() (lib/i18n/category-name.ts)
  // keeps returning the translated dictionary string forever and the
  // user's rename appears to silently fail everywhere the name is shown.
  // Only triggered on an actual name change, fetched separately since the
  // client only sends the fields it's changing (a color/icon-only edit
  // must leave is_default/translation_key untouched).
  let updateData: typeof payload.data & { is_default?: false; translation_key?: null } = payload.data;
  if (payload.data.name !== undefined) {
    const { data: existing } = await auth.supabase
      .from("categories")
      .select("name, is_default")
      .eq("id", id)
      .eq("user_id", auth.user.id)
      .single();
    if (existing?.is_default && existing.name !== payload.data.name) {
      updateData = { ...payload.data, is_default: false, translation_key: null };
    }
  }

  const { error } = await auth.supabase
    .from("categories")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("categories")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
