import { TransactionList } from "@/components/transactions/transaction-list";
import { requireSpaceContext } from "@/lib/spaces/context";

export default async function TransactionsPage() {
  const { space } = await requireSpaceContext();

  return (
    <section className="space-y-4">
      <TransactionList spaceKind={space.kind} />
    </section>
  );
}
