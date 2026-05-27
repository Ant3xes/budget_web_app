import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const [accountsResult, transactionsResult, budgetsResult, subscriptionsResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("initial_balance_cents")
      .is("deleted_at", null),
    supabase
      .from("transactions")
      .select("amount_cents, date, description")
      .is("deleted_at", null)
      .order("date", { ascending: false })
      .limit(10),
    supabase.from("budgets").select("id").is("deleted_at", null),
    supabase
      .from("subscriptions")
      .select("name, next_charge_at")
      .is("deleted_at", null)
      .order("next_charge_at", { ascending: true })
      .limit(5),
  ]);

  const totalAccountBalance = (accountsResult.data ?? []).reduce(
    (sum, account) => sum + Number(account.initial_balance_cents ?? 0),
    0,
  );
  const totalTransactions = (transactionsResult.data ?? []).reduce(
    (sum, transaction) => sum + Number(transaction.amount_cents ?? 0),
    0,
  );

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm text-zinc-500">Consolidated balance</h2>
          <p className="mt-1 text-xl font-semibold">€{((totalAccountBalance + totalTransactions) / 100).toFixed(2)}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm text-zinc-500">Monthly budgets</h2>
          <p className="mt-1 text-xl font-semibold">{budgetsResult.data?.length ?? 0}</p>
        </article>
        <article className="rounded-lg bg-white p-4 shadow-sm">
          <h2 className="text-sm text-zinc-500">Upcoming subscriptions</h2>
          <p className="mt-1 text-xl font-semibold">{subscriptionsResult.data?.length ?? 0}</p>
        </article>
      </div>

      <article className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">Last 10 transactions</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {(transactionsResult.data ?? []).map((transaction) => (
            <li key={`${transaction.date}-${transaction.description}`} className="flex justify-between border-b border-zinc-100 pb-2">
              <span>{transaction.description ?? "Transaction"}</span>
              <span>€{(Number(transaction.amount_cents) / 100).toFixed(2)}</span>
            </li>
          ))}
          {!transactionsResult.data?.length ? <li className="text-zinc-500">No transactions yet.</li> : null}
        </ul>
      </article>
    </section>
  );
}
