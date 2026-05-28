import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const ruleSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  category_id: z.string().uuid(),
  kind: z.enum(["expense", "income"]),
});

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

export async function GET() {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("csv_import_rules")
    .select("id, keyword, category_id, kind, priority, categories(name, icon)")
    .eq("user_id", auth.user.id)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = ruleSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  // Assign priority = max existing priority + 1
  const { data: maxData } = await auth.supabase
    .from("csv_import_rules")
    .select("priority")
    .eq("user_id", auth.user.id)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  const priority = maxData ? (maxData.priority as number) + 1 : 0;

  const { data, error } = await auth.supabase
    .from("csv_import_rules")
    .insert({ ...payload.data, user_id: auth.user.id, priority })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ rule: data }, { status: 201 });
}
