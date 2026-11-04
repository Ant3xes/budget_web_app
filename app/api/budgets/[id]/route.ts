import { demoReadOnlyResponse } from "@/lib/api/demo";
import { NextResponse } from "next/server";
import { z } from "zod";
import { positiveAmountCentsSchema } from "@/lib/validation/fields";
import { pgErrorResponse } from "@/lib/spaces/pg-error";

import { withSpace } from "@/lib/spaces/with-space";
import { invalidIdResponse } from "@/lib/api/validate-id";

const budgetUpdateSchema = z.object({
  amount_cents: positiveAmountCentsSchema.optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.isDemo) return demoReadOnlyResponse();

  const { id } = await params;
  const badId = invalidIdResponse(id);
  if (badId) return badId;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const payload = budgetUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("budgets")
    .update(payload.data)
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null);

  if (error) return pgErrorResponse(error);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.isDemo) return demoReadOnlyResponse();

  const { id } = await params;
  const badId = invalidIdResponse(id);
  if (badId) return badId;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await auth.supabase
    .from("budgets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null);

  if (error) return pgErrorResponse(error);

  return NextResponse.json({ ok: true });
}
