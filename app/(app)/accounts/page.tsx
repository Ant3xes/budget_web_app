import type { Metadata } from "next";

import { AccountsList } from "@/components/accounts/accounts-list";
import { AccountsImportButton } from "@/components/accounts/accounts-import-button";
import { balanceAfterAnchor } from "@/lib/accounts/balance-after-anchor";
import { groupAccountsByBank } from "@/lib/accounts/group-accounts-by-bank";
import { requireSpaceContext } from "@/lib/spaces/context";

export const metadata: Metadata = {
  title: "Comptes",
  description: "Vos comptes bancaires regroupés par banque, avec soldes à jour.",
};

type AccountWithTransactions = {
  id: string;
  name: string;
  type: string;
  currency: string;
  bank: string | null;
  initial_balance_cents: number;
  balance_anchor_date: string;
  transactions: { amount_cents: number; deleted_at: string | null; kind: string; date: string }[] | null;
};

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ bank?: string }> }) {
  const { bank: selectedBank } = await searchParams;
  const { supabase, spaceId, space } = await requireSpaceContext();
  const { data } = await supabase
    .from("accounts")
    .select("id, name, type, currency, bank, initial_balance_cents, balance_anchor_date, transactions(amount_cents, deleted_at, kind, date)")
    .eq("space_id", spaceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const accounts = (data ?? []) as AccountWithTransactions[];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const accountCards = accounts.map((account) => {
    const activeTxs = (account.transactions ?? []).filter((t) => t.deleted_at === null);
    // Issue 104: only operations after the balance anchor date move the balance.
    const balanceCents = balanceAfterAnchor(account.initial_balance_cents, account.balance_anchor_date, activeTxs);
    const monthExpenseCents = activeTxs
      .filter((t) => t.kind === "expense" && t.date >= monthStart && t.date <= monthEnd)
      .reduce((sum, t) => sum + Math.abs(Number(t.amount_cents)), 0);

    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      bank: account.bank,
      balanceCents,
      monthExpenseCents,
    };
  });

  // Group by bank (alphabetical, fr locale, no-bank trailing), then by
  // account type within each group, so accounts read like a bank statement
  // list rather than most-recently-created-first (plan: accounts page bank
  // grouping).
  const groups = groupAccountsByBank(accountCards);

  return (
    <section className="space-y-4">
      <AccountsList groups={groups} selectedBank={selectedBank}importButton={<AccountsImportButton spaceKind={space.kind} hasAccount={accounts.length > 0} />} />
    </section>
  );
}
