import { NextResponse } from "next/server";
import { z } from "zod";

import { nextRulePriority } from "@/lib/import/rules";
import { withSpace } from "@/lib/spaces/with-space";

const ruleSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  category_id: z.string().uuid(),
  kind: z.enum(["expense", "income"]),
});

export async function GET() {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("csv_import_rules")
    .select("id, keyword, category_id, kind, priority, categories(name, icon)")
    .eq("space_id", auth.spaceId)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = ruleSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const priority = await nextRulePriority(auth.supabase, auth.spaceId);

  const { data, error } = await auth.supabase
    .from("csv_import_rules")
    .insert({ ...payload.data, space_id: auth.spaceId, user_id: auth.user.id, priority })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ rule: data }, { status: 201 });
}
