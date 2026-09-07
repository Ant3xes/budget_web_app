import { NextResponse } from "next/server";

import { todayISO } from "@/lib/dates/period";
import { advanceOnePeriod, advanceWhile } from "@/lib/fixed-charges/due-date";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

/**
 * POST /api/fixed-charges/:id/pay
 * Marks a fixed charge as paid: records today as `last_paid_date` (the
 * dashboard's "Charges fixes" widget reads this to show what's already been
 * paid this month, issue #35 — uses the same local-calendar-date `todayISO`
 * as that widget's own query window, not a UTC date, so the two never
 * disagree near a day boundary) and advances `next_due_date` at least one
 * period past its current value — regardless of whether that value is
 * overdue, due today, or still upcoming, since paying early is a normal
 * case this shouldn't reject — then keeps advancing (same catch-up loop as
 * GET /api/fixed-charges's advanceDueDate) if it was overdue by more than
 * one period, so it doesn't stay overdue right after being paid.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { data: charge, error: fetchError } = await auth.supabase
    .from("fixed_charges")
    .select("next_due_date, frequency")
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .single();

  if (fetchError || !charge) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const todayStr = todayISO();
  const frequency = charge.frequency as "monthly" | "quarterly" | "yearly";
  // Always at least one period forward (covers paying early, before the
  // charge is even due), then advanceWhile catches up any further periods
  // it was also overdue by (a charge unpaid for 3 months shouldn't still
  // read as overdue right after being marked paid).
  const nextDueDate = advanceWhile(
    advanceOnePeriod(charge.next_due_date as string, frequency),
    frequency,
    (d) => d <= todayStr,
  );

  const { error } = await auth.supabase
    .from("fixed_charges")
    .update({ next_due_date: nextDueDate, last_paid_date: todayStr })
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, next_due_date: nextDueDate, last_paid_date: todayStr });
}
