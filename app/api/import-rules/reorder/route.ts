import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = reorderSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { ids } = payload.data;

  // Verify all ids belong to the current user before updating
  const { data: existing, error: fetchError } = await auth.supabase
    .from("csv_import_rules")
    .select("id")
    .eq("user_id", auth.user.id)
    .in("id", ids);

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });

  const ownedIds = new Set((existing ?? []).map((r) => r.id as string));
  if (ids.some((id) => !ownedIds.has(id))) {
    return NextResponse.json({ error: "One or more rules not found" }, { status: 403 });
  }

  // Update priorities in batch
  const updates = ids.map((id, index) =>
    auth.supabase
      .from("csv_import_rules")
      .update({ priority: index })
      .eq("id", id)
      .eq("user_id", auth.user.id),
  );

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
