"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { AccountModal } from "@/components/accounts/account-modal";
import { BalanceChart } from "@/components/accounts/balance-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { IncomeExpenseBarChart } from "@/components/dashboard/bar-chart";
import { ImportModal } from "@/components/import/import-modal";
import {
  computeDailyBalanceSeries,
  type BalanceSeriesTx,
} from "@/lib/accounts/compute-balance-series";
import { computeExpenseByCategory } from "@/lib/accounts/compute-expense-by-category";
import type { ExpenseByCategoryTx } from "@/lib/accounts/compute-expense-by-category";
import { ACCOUNT_TYPES } from "@/lib/constants";
import {
  PERIOD_PRESET_LABELS,
  addMonths,
  currentMonth,
  parsePeriodParam,
  periodBounds,
  periodToParam,
  toMonthLabel,
  type Period,
  type PeriodPreset,
} from "@/lib/dates/period";

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
  bank: string | null;
  currency: string;
  initial_balance_cents: number;
};

type IncomeExpensePoint = {
  key: string;
  month: string;
  income: number;
  expense: number;
};

interface AccountDetailProps {
  account: AccountInfo;
  balanceCents: number;
  initialPeriod: string; // query param value
  allTransactions: Transaction[];
  balanceTxs: BalanceSeriesTx[];
  incomeExpenseData: IncomeExpensePoint[];
  expenseHistory: ExpenseByCategoryTx[];
}

const PRESET_ORDER: PeriodPreset[] = ["1m", "3m", "6m", "1a", "2a", "tout"];

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
  initialPeriod,
  allTransactions,
  balanceTxs,
  incomeExpenseData,
  expenseHistory,
}: AccountDetailProps) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(() => parsePeriodParam(initialPeriod));
  const [menuOpen, setMenuOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const earliestDate = useMemo(() => {
    if (balanceTxs.length === 0) return null;
    return balanceTxs.reduce((min, tx) => {
      const d = tx.date.slice(0, 10);
      return d < min ? d : min;
    }, balanceTxs[0].date.slice(0, 10));
  }, [balanceTxs]);

  const { from, to, monthCount } = periodBounds(period, { earliestDate });

  const visibleBalanceData = computeDailyBalanceSeries(
    balanceTxs,
    account.initial_balance_cents,
    from,
    to,
  );
  const visibleIncomeExpenseData = (() => {
    if (period.type === "month") {
      const point = incomeExpenseData.find((p) => p.key === period.month);
      return point
        ? [point]
        : [{ key: period.month, month: toMonthLabel(period.month), income: 0, expense: 0 }];
    }
    if (monthCount === null) return incomeExpenseData;
    return incomeExpenseData.slice(-monthCount);
  })();
  const donutData = computeExpenseByCategory(expenseHistory, from, to);

  const periodTransactions = useMemo(
    () =>
      allTransactions
        .filter((t) => {
          const d = t.date.slice(0, 10);
          return d >= from && d <= to;
        })
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)),
    [allTransactions, from, to],
  );

  const expenses = periodTransactions.filter((t) => t.kind === "expense");
  const incomes = periodTransactions.filter((t) => t.kind === "income");
  const transfers = periodTransactions.filter(
    (t) => t.kind === "transfer_debit" || t.kind === "transfer_credit",
  );

  const selectedMonth = period.type === "month" ? period.month : currentMonth();
  const isCeMois =
    period.type === "month" && period.month === currentMonth();

  const applyPeriod = (next: Period) => {
    setPeriod(next);
    const param = periodToParam(next);
    const url =
      next.type === "month" && next.month === currentMonth()
        ? `/accounts/${account.id}`
        : `/accounts/${account.id}?period=${param}`;
    window.history.replaceState(null, "", url);
  };

  const selectPreset = (preset: PeriodPreset) => {
    if (preset === "1m") {
      applyPeriod({ type: "month", month: currentMonth() });
      return;
    }
    applyPeriod({ type: "preset", value: preset });
  };

  const shiftMonth = (delta: number) => {
    applyPeriod({ type: "month", month: addMonths(selectedMonth, delta) });
  };

  const isPresetActive = (preset: PeriodPreset) => {
    if (preset === "1m") return isCeMois;
    return period.type === "preset" && period.value === preset;
  };

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

        <div className="flex items-center gap-2">
          <button
            onClick={() => setImportModalOpen(true)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Importer
          </button>
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
      </div>

      {/* Shared period control */}
      <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {PRESET_ORDER.map((preset) => (
            <button
              key={preset}
              onClick={() => selectPreset(preset)}
              className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                isPresetActive(preset)
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
              }`}
            >
              {PERIOD_PRESET_LABELS[preset]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Mois</span>
          <button
            onClick={() => shiftMonth(-1)}
            className="rounded p-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Mois précédent"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => applyPeriod({ type: "month", month: selectedMonth })}
            className={`min-w-[9rem] rounded px-2 py-1 text-sm font-medium capitalize transition-colors ${
              period.type === "month"
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            {toMonthLabel(selectedMonth)}
          </button>
          <button
            onClick={() => shiftMonth(1)}
            className="rounded p-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Mois suivant"
          >
            →
          </button>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              if (e.target.value) applyPeriod({ type: "month", month: e.target.value });
            }}
            className="rounded border border-zinc-200 bg-transparent px-2 py-1 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            aria-label="Choisir un mois"
          />
        </div>
      </div>

      {/* Charts */}
      <div className="space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Évolution du solde
          </h2>
          <BalanceChart data={visibleBalanceData} currency={account.currency} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Revenus vs Dépenses
            </h2>
            <IncomeExpenseBarChart data={visibleIncomeExpenseData} height={200} />
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">
              Dépenses par catégorie
            </h2>
            <DonutChart data={donutData} height={200} />
          </div>
        </div>
      </div>

      {/* Transaction lists for the same period */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TxTable
          title="Dépenses"
          transactions={expenses}
          emptyLabel="Aucune dépense sur cette période"
          amountColor={() => "text-red-500"}
        />
        <TxTable
          title="Revenus"
          transactions={incomes}
          emptyLabel="Aucun revenu sur cette période"
          amountColor={() => "text-green-600"}
        />
      </div>

      <TxTable
        title="Virements"
        transactions={transfers}
        emptyLabel="Aucun virement sur cette période"
        showSens
        amountColor={(tx) =>
          tx.kind === "transfer_credit" ? "text-green-600" : "text-orange-500"
        }
      />

      {editModalOpen && (
        <AccountModal
          accountId={account.id}
          defaultValues={{
            name: account.name,
            type: account.type as (typeof ACCOUNT_TYPES)[number],
            bank: account.bank ?? "",
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

      {importModalOpen && (
        <ImportModal
          defaultAccountId={account.id}
          onClose={() => setImportModalOpen(false)}
          onSuccess={() => {
            setImportModalOpen(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
