"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AccountModal } from "@/components/accounts/account-modal";
import { BalanceChart } from "@/components/accounts/balance-chart";
import type { BalanceChartData } from "@/components/accounts/balance-chart";
import { ACCOUNT_TYPES } from "@/lib/constants";

type Transaction = {
  id: string;
  kind: "expense" | "income" | "transfer_debit" | "transfer_credit";
  amount_cents: number;
  currency: string;
  date: string;
  description: string;
  notes: string | null;
  categories: { name: string; color: string | null; icon: string | null } | null;
};

type AccountInfo = {
  id: string;
  name: string;
  type: string;
  currency: string;
  initial_balance_cents: number;
};

interface AccountDetailProps {
  account: AccountInfo;
  balanceCents: number;
  initialTransactions: Transaction[];
  initialMonth: string; // "YYYY-MM"
  chartData: BalanceChartData[];
}

const formatEuros = (cents: number, currency: string) =>
  `${(Math.abs(cents) / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${currency}`;

const formatBalance = (cents: number, currency: string) =>
  `${(cents / 100).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

const TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  courant: "Courant",
  épargne: "Épargne",
  livret: "Livret",
  PEL: "PEL",
  autre: "Autre",
};

function toMonthLabel(yyyyMM: string) {
  const [y, m] = yyyyMM.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });
}

function addMonths(yyyyMM: string, delta: number): string {
  const [y, m] = yyyyMM.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Mini transaction table ────────────────────────────────────────────────

interface TxTableProps {
  title: string;
  transactions: Transaction[];
  emptyLabel: string;
  showSens?: boolean;
  amountColor: (tx: Transaction) => string;
}

function TxTable({ title, transactions, emptyLabel, showSens, amountColor }: TxTableProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
        <h3 className="text-sm font-semibold">{title}</h3>
        {transactions.length > 0 && (
          <p className="mt-0.5 text-xs text-zinc-400">
            {transactions.length} opération{transactions.length > 1 ? "s" : ""}
          </p>
        )}
      </div>
      {transactions.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-xs text-zinc-400">{emptyLabel}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Catégorie</th>
                {showSens && <th className="px-3 py-2">Sens</th>}
                <th className="px-3 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b border-zinc-50 last:border-0 dark:border-zinc-800">
                  <td className="px-3 py-2 text-xs text-zinc-500">{formatDate(tx.date)}</td>
                  <td className="max-w-[160px] truncate px-3 py-2 text-xs">{tx.description}</td>
                  <td className="px-3 py-2">
                    {tx.categories ? (
                      <span className="flex items-center gap-1">
                        {tx.categories.icon && <span className="text-sm">{tx.categories.icon}</span>}
                        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {tx.categories.name}
                        </span>
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-300 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  {showSens && (
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          tx.kind === "transfer_credit"
                            ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                            : "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400"
                        }`}
                      >
                        {tx.kind === "transfer_credit" ? "Entrant" : "Sortant"}
                      </span>
                    </td>
                  )}
                  <td className={`px-3 py-2 text-right text-xs font-medium ${amountColor(tx)}`}>
                    {tx.amount_cents >= 0 ? "+" : "−"}
                    {formatEuros(tx.amount_cents, tx.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

export function AccountDetail({
  account,
  balanceCents,
  initialTransactions,
  initialMonth,
  chartData,
}: AccountDetailProps) {
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [transactions, setTransactions] = useState<Transaction[]>(initialTransactions);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [chartRange, setChartRange] = useState<"3m" | "6m" | "1a" | "2a" | "tout">("6m");
  const menuRef = useRef<HTMLDivElement>(null);

  const RANGE_LABELS = { "3m": "3 mois", "6m": "6 mois", "1a": "1 an", "2a": "2 ans", "tout": "Tout" } as const;
  const RANGE_MONTHS: Record<"3m" | "6m" | "1a" | "2a" | "tout", number | null> = {
    "3m": 3, "6m": 6, "1a": 12, "2a": 24, "tout": null,
  };
  const rangeCount = RANGE_MONTHS[chartRange];
  const visibleChartData = rangeCount === null ? chartData : chartData.slice(-rangeCount);

  const fetchTransactions = useCallback(
    async (targetMonth: string) => {
      setIsLoading(true);
      const [y, m] = targetMonth.split("-").map(Number);
      const dateFrom = `${targetMonth}-01`;
      const dateTo = new Date(y, m, 0).toISOString().slice(0, 10);
      const params = new URLSearchParams({
        account_id: account.id,
        date_from: dateFrom,
        date_to: dateTo,
        per_page: "100",
      });
      const res = await fetch(`/api/transactions?${params.toString()}`);
      const json = (await res.json()) as { transactions: Transaction[] };
      setTransactions(json.transactions ?? []);
      setIsLoading(false);
    },
    [account.id],
  );

  const changeMonth = (delta: number) => {
    const newMonth = addMonths(month, delta);
    setMonth(newMonth);
    window.history.replaceState(null, "", `/accounts/${account.id}?month=${newMonth}`);
    void fetchTransactions(newMonth);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleDelete = async () => {
    if (!window.confirm(`Supprimer le compte « ${account.name} » ? Cette action est irréversible.`)) return;
    setIsDeleting(true);
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id }),
    });
    router.push("/accounts");
    router.refresh();
  };

  // Split into 3 groups
  const expenses = transactions.filter((t) => t.kind === "expense");
  const incomes = transactions.filter((t) => t.kind === "income");
  const transfers = transactions.filter(
    (t) => t.kind === "transfer_debit" || t.kind === "transfer_credit",
  );

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{account.name}</h1>
          <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {TYPE_LABELS[account.type as (typeof ACCOUNT_TYPES)[number]] ?? account.type}
          </span>
          <p
            className={`mt-3 text-3xl font-semibold tracking-tight ${
              balanceCents >= 0 ? "text-zinc-900 dark:text-zinc-100" : "text-red-600"
            }`}
          >
            {formatBalance(balanceCents, account.currency)}
          </p>
        </div>

        {/* 3-dot menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Options"
          >
            <span className="text-lg leading-none text-zinc-500">⋮</span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-10 z-20 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              <button
                onClick={() => { setMenuOpen(false); setEditModalOpen(true); }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Éditer
              </button>
              <button
                onClick={() => { setMenuOpen(false); void handleDelete(); }}
                disabled={isDeleting}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-zinc-50 disabled:opacity-50 dark:hover:bg-zinc-800"
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Balance chart */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Évolution du solde</h2>
          <div className="flex gap-1">
            {(["3m", "6m", "1a", "2a", "tout"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  chartRange === r
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
              >
                {RANGE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
        <BalanceChart data={visibleChartData} currency={account.currency} />
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <button
          onClick={() => changeMonth(-1)}
          className="rounded p-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          ←
        </button>
        <span className="text-sm font-medium capitalize">{toMonthLabel(month)}</span>
        <button
          onClick={() => changeMonth(1)}
          className="rounded p-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          →
        </button>
      </div>

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-sm text-zinc-400">Chargement…</div>
      ) : (
        <>
          {/* Dépenses | Revenus côte à côte */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TxTable
              title="Dépenses"
              transactions={expenses}
              emptyLabel="Aucune dépense ce mois-ci"
              amountColor={() => "text-red-500"}
            />
            <TxTable
              title="Revenus"
              transactions={incomes}
              emptyLabel="Aucun revenu ce mois-ci"
              amountColor={() => "text-green-600"}
            />
          </div>

          {/* Virements — full width */}
          <TxTable
            title="Virements"
            transactions={transfers}
            emptyLabel="Aucun virement ce mois-ci"
            showSens
            amountColor={(tx) =>
              tx.kind === "transfer_credit" ? "text-green-600" : "text-orange-500"
            }
          />
        </>
      )}

      {/* Edit modal */}
      {editModalOpen && (
        <AccountModal
          accountId={account.id}
          defaultValues={{
            name: account.name,
            type: account.type as (typeof ACCOUNT_TYPES)[number],
            initialBalanceCents: account.initial_balance_cents,
            currency: account.currency,
          }}
          onClose={() => setEditModalOpen(false)}
          onSuccess={() => {
            setEditModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}

