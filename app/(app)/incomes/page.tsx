import { TransactionList } from "@/components/transactions/transaction-list";

export default function IncomesPage() {
  return (
    <section className="p-6">
      <TransactionList kind="income" />
    </section>
  );
}
