import { demoReadOnlyResponse } from "@/lib/api/demo";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isoDateSchema, positiveAmountCentsSchema } from "@/lib/validation/fields";
import { pgErrorResponse } from "@/lib/spaces/pg-error";

import { withSpace } from "@/lib/spaces/with-space";
import { uuidSchema } from "@/lib/validation/uuid";
import { invalidIdResponse } from "@/lib/api/validate-id";

const fixedChargeUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  amount_cents: positiveAmountCentsSchema.optional(),
  frequency: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  next_due_date: isoDateSchema
    .optional(),
  account_id: uuidSchema.optional().nullable(),
  category_id: uuidSchema.optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  status: z.enum(["active", "suspended", "cancelled"]).optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (auth.isDemo) return demoReadOnlyResponse();

  const { id } = await params;
  const badId = invalidIdResponse(id);
  if (badId) return badId;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const payload = fixedChargeUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("fixed_charges")
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
    .from("fixed_charges")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null);

  if (error) return pgErrorResponse(error);

  return NextResponse.json({ ok: true });
}
