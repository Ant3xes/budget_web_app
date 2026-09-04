import { notFound } from "next/navigation";

import { AccountDetail } from "@/components/accounts/account-detail";
import { computeIncomeExpenseSeries } from "@/lib/accounts/compute-income-expense-series";
import { periodToParam, parsePeriodParam } from "@/lib/dates/period";
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

export default async function AccountDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; month?: string }>;
}) {
  const { id } = await params;
  const { period: periodParam, month: monthParam } = await searchParams;
  // Support legacy ?month=YYYY-MM as well as ?period=
  const initialPeriod = periodToParam(parsePeriodParam(periodParam ?? monthParam));

  const supabase = await createServerSupabaseClient();
  const { data: account } = await supabase
    .from("accounts")
    .select("id, name, type, bank, initial_balance_cents, currency")
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
      date: String(row.date).slice(0, 10),
      description: row.description as string,
      notes: (row.notes as string | null) ?? null,
      categories,
    };
  });

  const balanceCents =
    Number(account.initial_balance_cents) +
    transactions.reduce((sum, t) => sum + Number(t.amount_cents), 0);

  const incomeExpenseData = computeIncomeExpenseSeries(
    transactions.map((t) => ({
      date: t.date,
      kind: t.kind,
      amount_cents: Number(t.amount_cents),
    })),
    null,
  );

  const allTransactions = [...transactions].sort(
    (a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id),
  );

  return (
    <AccountDetail
      account={{
        id: account.id,
        name: account.name,
        type: account.type,
        bank: account.bank,
        currency: account.currency,
        initial_balance_cents: account.initial_balance_cents,
      }}
      balanceCents={balanceCents}
      initialPeriod={initialPeriod}
      allTransactions={allTransactions}
      balanceTxs={transactions.map((t) => ({
        date: t.date,
        amount_cents: t.amount_cents,
      }))}
      incomeExpenseData={incomeExpenseData}
      expenseHistory={transactions
        .filter((t) => t.kind === "expense")
        .map((t) => ({
          date: t.date,
          amount_cents: t.amount_cents,
          categoryName: t.categories?.name ?? null,
          categoryColor: t.categories?.color ?? null,
        }))}
    />
  );
}
