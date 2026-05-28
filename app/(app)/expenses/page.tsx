import { TransactionList } from "@/components/transactions/transaction-list";

export default function ExpensesPage() {
  return (
    <section className="p-6">
      <TransactionList kind="expense" />
    </section>
  );
}
