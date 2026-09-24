import { NextResponse } from "next/server";
import { z } from "zod";

import { pgErrorResponse } from "@/lib/spaces/pg-error";
import { withSpace } from "@/lib/spaces/with-space";

const createSchema = z
  .object({
    from_user: z.guid(),
    to_user: z.guid(),
    amount_cents: z.number().int().positive().optional(),
    // A full timestamp, or a plain YYYY-MM-DD as sent by the date input of the
    // settlement form (stored at noon UTC so the day is the same in any timezone).
    date: z.union([z.iso.datetime({ offset: true }), z.iso.date().transform((day) => `${day}T12:00:00Z`)]).optional(),
    source_transaction_id: z.guid().optional(),
  })
  .refine((value) => value.amount_cents !== undefined || value.source_transaction_id !== undefined, {
    message: "amount_cents is required without a source transaction",
  })
  .refine((value) => value.from_user !== value.to_user, { message: "from_user and to_user must differ" });

/** Records "X paid Y back" in the active shared space. */
export async function POST(request: Request) {
  const auth = await withSpace();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (auth.space.kind !== "shared") {
    return NextResponse.json({ error: "Settlements only exist in shared spaces" }, { status: 400 });
  }

  const payload = createSchema.safeParse(await request.json().catch(() => null));
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }
  const { from_user, to_user, amount_cents, date, source_transaction_id } = payload.data;

  // With a source transaction the trigger takes amount and date from it.
  const { data, error } = await auth.supabase
    .from("settlements")
    .insert({
      space_id: auth.spaceId,
      created_by: auth.user.id,
      from_user,
      to_user,
      ...(source_transaction_id ? { source_transaction_id } : { amount_cents, ...(date ? { date } : {}) }),
    } as never)
    .select("id")
    .single();

  if (error) return pgErrorResponse(error);
  return NextResponse.json({ id: (data as { id: string }).id });
}
