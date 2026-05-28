import { NextResponse } from "next/server";
import { z } from "zod";

import { ACCOUNT_TYPES } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const accountSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  type: z.enum(ACCOUNT_TYPES),
  initialBalanceCents: z.coerce.number().int(),
  currency: z.string().length(3).default("EUR"),
});

const deleteSchema = z.object({ id: z.string().uuid() });

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return { supabase, user };
};

export async function GET() {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("accounts")
    .select("id, name, type, currency, initial_balance_cents")
    .eq("user_id", auth.user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ accounts: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = accountSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("accounts").insert({
    user_id: auth.user.id,
    name: payload.data.name,
    type: payload.data.type,
    initial_balance_cents: payload.data.initialBalanceCents,
    currency: payload.data.currency.toUpperCase(),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = accountSchema.extend({ id: z.string().uuid() }).safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("accounts")
    .update({
      name: payload.data.name,
      type: payload.data.type,
      initial_balance_cents: payload.data.initialBalanceCents,
      currency: payload.data.currency.toUpperCase(),
    })
    .eq("id", payload.data.id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = deleteSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("accounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", payload.data.id)
    .eq("user_id", auth.user.id)
    .is("deleted_at", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
