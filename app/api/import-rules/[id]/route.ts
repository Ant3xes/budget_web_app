import { NextResponse } from "next/server";
import { z } from "zod";

import { checkRuleShare } from "@/lib/import/rule-share-check";
import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";

const ruleUpdateSchema = z.object({
  keyword: z.string().trim().min(1).max(200).optional(),
  category_id: z.string().uuid().optional(),
  kind: z.enum(["expense", "income"]).optional(),
  share_space_id: z.guid().nullable().optional(),
  share_category_id: z.guid().nullable().optional(),
  share_payer_percent: z.number().min(0).max(100).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const payload = ruleUpdateSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  if (payload.data.share_space_id) {
    // The resulting kind decides: load the rule when the body does not carry it.
    let kind = payload.data.kind;
    if (!kind) {
      const { data: rule, error: ruleError } = await auth.supabase
        .from("csv_import_rules")
        .select("kind")
        .eq("id", id)
        .eq("space_id", auth.spaceId)
        .maybeSingle();
      if (ruleError) return pgErrorResponse(ruleError);
      if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });
      kind = rule.kind as "expense" | "income";
    }
    const refusal = checkRuleShare(auth, kind, payload.data.share_space_id);
    if (refusal) return refusal;
  }

  const { error } = await auth.supabase
    .from("csv_import_rules")
    .update(payload.data)
    .eq("id", id)
    .eq("space_id", auth.spaceId);

  if (error) return pgErrorResponse(error);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await auth.supabase
    .from("csv_import_rules")
    .delete()
    .eq("id", id)
    .eq("space_id", auth.spaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
