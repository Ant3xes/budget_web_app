import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { formatEuros } from "@/lib/format";

interface RecentTransaction {
  id: string;
  amount_cents: number;
  description: string | null;
  categories: { name: string } | null;
}

interface RecentTransactionsProps {
  transactions: RecentTransaction[];
}

/**
 * "Dernières transactions" list. Extracted verbatim from
 * app/(app)/dashboard/page.tsx — plan §Étape 1 (structural extraction, no
 * visual change).
 */
export function RecentTransactions({ transactions }: RecentTransactionsProps) {
  return (
    <DashboardCard>
      <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Dernières transactions</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {transactions.map((tx) => (
          <li key={tx.id} className="flex justify-between border-b border-zinc-100 pb-2 dark:border-zinc-800">
            <span className="truncate max-w-xs text-zinc-700 dark:text-zinc-300">
              {tx.description ?? "Transaction"}
              {tx.categories?.name && (
                <span className="ml-1.5 text-xs text-zinc-400">· {tx.categories.name}</span>
              )}
            </span>
            <span className={`ml-4 shrink-0 font-medium ${tx.amount_cents < 0 ? "text-red-600" : "text-green-600"}`}>
              {tx.amount_cents < 0 ? "−" : "+"}
              {formatEuros(Math.abs(tx.amount_cents))}
            </span>
          </li>
        ))}
        {transactions.length === 0 && <li className="text-zinc-500">Aucune transaction.</li>}
      </ul>
    </DashboardCard>
  );
}
