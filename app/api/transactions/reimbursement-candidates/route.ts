import { NextResponse } from "next/server";
import { z } from "zod";

import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";
import { uuidSchema } from "@/lib/validation/uuid";

const querySchema = z.object({
  // "incoming": recent unlinked incoming transactions (to reimburse an expense).
  // "expense": recent expenses (for an incoming transaction to reimburse).
  for: z.enum(["incoming", "expense"]),
  exclude: uuidSchema.optional(),
});

const LIMIT = 50;

export async function GET(request: Request) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });

  let builder = auth.supabase
    .from("transactions")
    .select("id, date, description, amount_cents, currency")
    .eq("space_id", auth.spaceId)
    .is("deleted_at", null)
    .order("date", { ascending: false })
    .limit(LIMIT);

  builder =
    query.data.for === "incoming"
      ? builder.in("kind", ["income", "transfer_credit"]).gt("amount_cents", 0).is("reimburses_transaction_id", null)
      : builder.eq("kind", "expense").lt("amount_cents", 0).is("transfer_id", null);
  if (query.data.exclude) builder = builder.neq("id", query.data.exclude);

  const { data, error } = await builder;
  if (error) return pgErrorResponse(error);
  return NextResponse.json({ transactions: data ?? [] });
}
