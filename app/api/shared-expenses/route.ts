import { NextResponse } from "next/server";
import { z } from "zod";

import { splitShares } from "@/lib/shared-expenses/split-shares";
import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";

const createSchema = z.object({
  transaction_id: z.guid(),
  space_id: z.guid(),
  category_id: z.guid().nullable().optional(),
  payer_share_percent: z.number().min(0).max(100).optional(),
});

/**
 * Shares an expense of the caller's personal space into a shared space.
 * Deliberately not filtered by the active space: the transaction lives in the
 * personal space; the DB triggers validate the source and fill the snapshot.
 */
export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = createSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }
  const { transaction_id, space_id, category_id, payer_share_percent } = payload.data;

  if (!auth.spaces.some((space) => space.id === space_id && space.kind === "shared")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [membersResult, spaceResult] = await Promise.all([
    auth.supabase.from("space_members").select("user_id").eq("space_id", space_id),
    auth.supabase.from("spaces").select("default_share_percent").eq("id", space_id).maybeSingle(),
  ]);
  if (membersResult.error) return pgErrorResponse(membersResult.error);
  if (spaceResult.error) return pgErrorResponse(spaceResult.error);

  const memberIds = (membersResult.data ?? []).map((row) => row.user_id);
  const percent = payer_share_percent ?? spaceResult.data?.default_share_percent ?? 50;

  let shares;
  try {
    shares = splitShares(auth.user.id, memberIds, percent);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid shares" }, { status: 400 });
  }

  // amount / currency / date / description are forced from the source by a trigger.
  const { data, error } = await auth.supabase
    .from("shared_expenses")
    .insert({
      space_id,
      source_transaction_id: transaction_id,
      paid_by: auth.user.id,
      category_id: category_id ?? null,
      shares,
    } as never)
    .select("id")
    .single();

  if (error) return pgErrorResponse(error);
  return NextResponse.json({ id: (data as { id: string }).id });
}
