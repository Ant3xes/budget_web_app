import { demoReadOnlyResponse } from "@/lib/api/demo";
import { NextResponse } from "next/server";
import { z } from "zod";

import { withSpace } from "@/lib/spaces/with-space";
import { listTransactions, transactionQuerySchema } from "@/lib/transactions/list-transactions";
import { uuidSchema } from "@/lib/validation/uuid";

const transactionSchema = z.object({
  account_id: uuidSchema,
  kind: z.enum(["expense", "income"]),
  amount_cents: z.number().int(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(255),
  category_id: uuidSchema.optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = transactionQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!query.success) {
    return NextResponse.json({ error: query.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const result = await listTransactions(auth.supabase, auth.spaceId, query.data);
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json(result.data);
}

export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.isDemo) return demoReadOnlyResponse();

  const payload = transactionSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("transactions").insert({
    space_id: auth.spaceId,
    user_id: auth.user.id,
    account_id: payload.data.account_id,
    kind: payload.data.kind,
    amount_cents: payload.data.amount_cents,
    date: payload.data.date,
    description: payload.data.description,
    category_id: payload.data.category_id ?? null,
    notes: payload.data.notes ?? null,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
