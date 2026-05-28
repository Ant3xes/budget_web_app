import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

const transferSchema = z.object({
  from_account_id: z.string().uuid(),
  to_account_id: z.string().uuid(),
  amount_cents: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(255).optional().nullable(),
});

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

export async function GET(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const perPage = 25;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  // Fetch transfer_debit transactions (one per transfer pair)
  const { data, error, count } = await auth.supabase
    .from("transactions")
    .select(
      "id, transfer_id, amount_cents, currency, date, description, account_id, accounts(name)",
      { count: "exact" },
    )
    .eq("user_id", auth.user.id)
    .eq("kind", "transfer_debit")
    .is("deleted_at", null)
    .not("transfer_id", "is", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Fetch corresponding credit transactions to get destination account
  const transferIds = (data ?? []).map((t) => t.transfer_id).filter(Boolean) as string[];

  let credits: Record<string, { account_id: string; accounts: { name: string } | null }> = {};
  if (transferIds.length > 0) {
    const { data: creditData } = await auth.supabase
      .from("transactions")
      .select("transfer_id, account_id, accounts(name)")
      .eq("user_id", auth.user.id)
      .eq("kind", "transfer_credit")
      .is("deleted_at", null)
      .in("transfer_id", transferIds);

    credits = Object.fromEntries(
      (creditData ?? []).map((c) => [c.transfer_id, c]),
    );
  }

  const transfers = (data ?? []).map((t) => ({
    transfer_id: t.transfer_id,
    debit_transaction_id: t.id,
    amount_cents: t.amount_cents,
    currency: t.currency,
    date: t.date,
    description: t.description,
    from_account: t.accounts,
    to_account: credits[t.transfer_id ?? ""]?.accounts ?? null,
  }));

  return NextResponse.json({ transfers, total: count ?? 0 });
}

export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = transferSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.issues[0]?.message ?? "Invalid data" }, { status: 400 });
  }

  const { from_account_id, to_account_id, amount_cents, date, description } = payload.data;

  if (from_account_id === to_account_id) {
    return NextResponse.json({ error: "Les comptes source et destination doivent être différents" }, { status: 400 });
  }

  const transferId = crypto.randomUUID();

  const { error } = await auth.supabase.from("transactions").insert([
    {
      user_id: auth.user.id,
      account_id: from_account_id,
      kind: "transfer_debit",
      amount_cents: -amount_cents,
      currency: "EUR",
      date,
      description: description ?? "Virement",
      transfer_id: transferId,
    },
    {
      user_id: auth.user.id,
      account_id: to_account_id,
      kind: "transfer_credit",
      amount_cents: amount_cents,
      currency: "EUR",
      date,
      description: description ?? "Virement",
      transfer_id: transferId,
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, transfer_id: transferId });
}
