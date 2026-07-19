import { notFound } from "next/navigation";

import { AccountDetail } from "@/components/accounts/account-detail";
import { computeBalanceSeries } from "@/lib/accounts/compute-balance-series";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type TxRow = {
  id: string;
  kind: "expense" | "income" | "transfer_debit" | "transfer_credit";
  amount_cents: number;
  currency: string;
  date: string;
  description: string;
  notes: string | null;
  categories: { name: string; color: string | null; icon: string | null } | null;
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMonth(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

function monthBounds(yyyyMM: string): { from: string; to: string } {
  const [y, m] = yyyyMM.split("-").map(Number);
  const from = `${yyyyMM}-01`;
  const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { from, to };
}

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month: monthParam } = await searchParams;
  const initialMonth = isValidMonth(monthParam) ? monthParam : currentMonth();

  const supabase = await createServerSupabaseClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, type, initial_balance_cents, currency")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!account) {
    notFound();
  }

  const { data: allTxs } = await supabase
    .from("transactions")
    .select(
      "id, kind, amount_cents, currency, date, description, notes, categories(name, color, icon)",
    )
    .eq("account_id", id)
    .is("deleted_at", null)
    .order("date", { ascending: true });

  const transactions: TxRow[] = (allTxs ?? []).map((row) => {
    const categoriesRaw = row.categories as
      | { name: string; color: string | null; icon: string | null }
      | { name: string; color: string | null; icon: string | null }[]
      | null;
    const categories = Array.isArray(categoriesRaw)
      ? (categoriesRaw[0] ?? null)
      : categoriesRaw;

    return {
      id: row.id as string,
      kind: row.kind as TxRow["kind"],
      amount_cents: Number(row.amount_cents),
      currency: row.currency as string,
      date: row.date as string,
      description: row.description as string,
      notes: (row.notes as string | null) ?? null,
      categories,
    };
  });

  const balanceCents =
    Number(account.initial_balance_cents) +
    transactions.reduce((sum, t) => sum + Number(t.amount_cents), 0);

  const chartData = computeBalanceSeries(
    transactions.map((t) => ({ date: t.date, amount_cents: Number(t.amount_cents) })),
    Number(account.initial_balance_cents),
  );

  const { from, to } = monthBounds(initialMonth);
  const monthTransactions = transactions
    .filter((t) => t.date >= from && t.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 100);

  return (
    <AccountDetail
      account={{
        id: account.id,
        name: account.name,
        type: account.type,
        currency: account.currency,
        initial_balance_cents: account.initial_balance_cents,
      }}
      balanceCents={balanceCents}
      initialMonth={initialMonth}
      initialTransactions={monthTransactions}
      chartData={chartData}
    />
  );
}
