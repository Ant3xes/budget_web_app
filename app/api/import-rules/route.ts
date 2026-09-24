import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRuleShare } from "@/lib/import/rule-share-check";
import { nextRulePriority } from "@/lib/import/rules";
import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";

const ruleSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  category_id: z.string().uuid(),
  kind: z.enum(["expense", "income"]),
  share_space_id: z.guid().nullable().optional(),
  share_category_id: z.guid().nullable().optional(),
  share_payer_percent: z.number().min(0).max(100).nullable().optional(),
});

export async function GET() {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await auth.supabase
    .from("csv_import_rules")
    .select(
      "id, keyword, category_id, kind, priority, share_space_id, share_category_id, share_payer_percent, " +
        "categories!csv_import_rules_category_id_fkey(name, icon), " +
        "share_space:spaces!csv_import_rules_share_space_id_fkey(name), " +
        "share_category:categories!csv_import_rules_share_category_id_fkey(name, icon)",
    )
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

  if (payload.data.share_space_id) {
    const refusal = checkRuleShare(auth, payload.data.kind, payload.data.share_space_id);
    if (refusal) return refusal;
  }

  const priority = await nextRulePriority(auth.supabase, auth.spaceId);

  const { data, error } = await auth.supabase
    .from("csv_import_rules")
    .insert({ ...payload.data, space_id: auth.spaceId, user_id: auth.user.id, priority })
    .select("id")
    .single();

  if (error) return pgErrorResponse(error);

  return NextResponse.json({ rule: data }, { status: 201 });
}
