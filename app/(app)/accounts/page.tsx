import Link from "next/link";

import { AccountForm } from "@/components/accounts/account-form";
import { DeleteAccountButton } from "@/components/accounts/delete-account-button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AccountWithTransactions = {
  id: string;
  name: string;
  type: string;
  currency: string;
  initial_balance_cents: number;
  transactions: { amount_cents: number; deleted_at: string | null }[] | null;
};

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, name, type, currency, initial_balance_cents, transactions(amount_cents, deleted_at)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const accounts = (data ?? []) as AccountWithTransactions[];

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <p className="mt-1 text-sm text-zinc-600">Balance = initial balance + sum of non-deleted transactions.</p>
      </div>

      <article className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">Create account</h2>
        <div className="mt-3 max-w-md">
          <AccountForm />
        </div>
      </article>

      <article className="rounded-lg bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">Your accounts</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-zinc-500">
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2">Current balance</th>
                <th className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => {
                const transactionsSum = (account.transactions ?? [])
                  .filter((transaction) => transaction.deleted_at === null)
                  .reduce((sum, transaction) => sum + Number(transaction.amount_cents), 0);
                const balance = Number(account.initial_balance_cents) + transactionsSum;

                return (
                  <tr key={account.id} className="border-b border-zinc-100">
                    <td className="py-2 pr-2">{account.name}</td>
                    <td className="py-2 pr-2">{account.type}</td>
                    <td className="py-2 pr-2">
                      {account.currency} {(balance / 100).toFixed(2)}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/accounts/${account.id}`}
                          className="rounded-md border border-zinc-300 px-2 py-1 text-xs"
                        >
                          Edit
                        </Link>
                        <DeleteAccountButton accountId={account.id} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!accounts.length ? <p className="mt-2 text-sm text-zinc-500">No accounts yet.</p> : null}
        </div>
      </article>
    </section>
  );
}
