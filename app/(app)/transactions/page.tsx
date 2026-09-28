import type { Metadata } from "next";

import { TransactionList } from "@/components/transactions/transaction-list";
import { requireSpaceContext } from "@/lib/spaces/context";

export const metadata: Metadata = {
  title: "Transactions",
  description: "Historique et filtrage des dépenses, revenus et virements.",
};

export default async function TransactionsPage() {
  const { space } = await requireSpaceContext();

  return (
    <section className="space-y-4">
      <TransactionList spaceKind={space.kind} />
    </section>
  );
}
