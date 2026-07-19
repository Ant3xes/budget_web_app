import { AccountsList } from "@/components/accounts/accounts-list";
import { AccountsImportButton } from "@/components/accounts/accounts-import-button";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AccountWithTransactions = {
  id: string;
  name: string;
  type: string;
  currency: string;
  initial_balance_cents: number;
  transactions: { amount_cents: number; deleted_at: string | null; kind: string; date: string }[] | null;
};

export default async function AccountsPage() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, name, type, currency, initial_balance_cents, transactions(amount_cents, deleted_at, kind, date)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const accounts = (data ?? []) as AccountWithTransactions[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const accountCards = accounts.map((account) => {
    const activeTxs = (account.transactions ?? []).filter((t) => t.deleted_at === null);
    const balanceCents =
      Number(account.initial_balance_cents) +
      activeTxs.reduce((sum, t) => sum + Number(t.amount_cents), 0);
    const monthExpenseCents = activeTxs
      .filter((t) => t.kind === "expense" && t.date >= monthStart && t.date <= monthEnd)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount_cents)), 0);

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balanceCents,
      monthExpenseCents,
    };
  });

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-end">
        <AccountsImportButton />
      </div>
      <AccountsList accounts={accountCards} />
    </section>
  );
}
