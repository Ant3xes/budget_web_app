import { NextResponse } from "next/server";

import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";

/** Received payments of the caller's personal space that can be linked to a settlement of the active shared space. */
export async function GET() {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.space.kind !== "shared") {
    return NextResponse.json({ error: "Settlements only exist in shared spaces" }, { status: 400 });
  }
  const personal = auth.spaces.find((space) => space.kind === "personal");
  if (!personal) return NextResponse.json({ transactions: [] });

  const { data: linked, error: linkedError } = await auth.supabase
    .from("settlements")
    .select("source_transaction_id")
    .eq("space_id", auth.spaceId)
    .not("source_transaction_id", "is", null);
  if (linkedError) return pgErrorResponse(linkedError);

  const linkedIds = (linked ?? []).map((row) => row.source_transaction_id).filter((id): id is string => !!id);

  let builder = auth.supabase
    .from("transactions")
    .select("id, date, description, amount_cents")
    .eq("space_id", personal.id)
    .in("kind", ["income", "transfer_credit"])
    .is("deleted_at", null)
    .gt("amount_cents", 0)
    .order("date", { ascending: false })
    .limit(50);
  if (linkedIds.length > 0) builder = builder.not("id", "in", `(${linkedIds.join(",")})`);

  const { data, error } = await builder;
  if (error) return pgErrorResponse(error);

  return NextResponse.json({ transactions: data ?? [] });
}
