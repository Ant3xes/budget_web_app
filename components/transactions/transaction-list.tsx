"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { ApplyRulesModal } from "@/components/transactions/apply-rules-modal";
import { ImportModal } from "@/components/import/import-modal";
import { TransactionModal } from "@/components/transactions/transaction-modal";
import { Pagination } from "@/components/ui/pagination";
import { CATEGORY_COLOR_FALLBACK } from "@/lib/constants";

type Transaction = {
  id: string;
  kind: "expense" | "income";
  amount_cents: number;
  currency: string;
  date: string;
  description: string;
  notes: string | null;
  is_imported: boolean;
  transfer_id: string | null;
  account_id: string;
  category_id: string | null;
  accounts: { name: string } | null;
  categories: { name: string; color: string | null; icon: string | null } | null;
};

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string };

interface TransactionListProps {
  kind: "expense" | "income";
}

const PER_PAGE = 25;

const formatAmount = (cents: number, currency: string) => {
  return `${currency} ${(Math.abs(cents) / 100).toFixed(2)}`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Europe/Paris",
  });

export function TransactionList({ kind }: TransactionListProps) {
  // Pre-filter from a drill-down link (e.g. the dashboard's category donut
  // or budget rows — plan §Étape 3), read once on mount. Read via
  // useSearchParams rather than a page-level prop so /expenses and /incomes
  // don't each need to thread a searchParams prop through just for this.
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState(() => searchParams.get("category_id") ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");

  // Reference data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showApplyRules, setShowApplyRules] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const totalPages = Math.ceil(total / PER_PAGE);

  const loadRefData = useCallback(async () => {
    const [accRes, catRes] = await Promise.all([fetch("/api/accounts"), fetch("/api/categories")]);
    if (accRes.ok) {
      const d = (await accRes.json()) as { accounts: Account[] };
      setAccounts(d.accounts ?? []);
    }
    if (catRes.ok) {
      const d = (await catRes.json()) as { categories: Category[] };
      setCategories((d.categories ?? []).filter((c) => c.kind === kind));
    }
  }, [kind]);

  const load = useCallback(
    async (p = page) => {
      setIsLoading(true);
      const params = new URLSearchParams({ kind, page: String(p), per_page: String(PER_PAGE) });
      if (accountId) params.set("account_id", accountId);
      if (categoryId) params.set("category_id", categoryId);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      if (q) params.set("q", q);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as { transactions: Transaction[]; total: number };
        setTransactions(data.transactions);
        setTotal(data.total);
      }
      setIsLoading(false);
    },
    [kind, page, accountId, categoryId, dateFrom, dateTo, q],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reference data fetch on mount
    void loadRefData();
  }, [loadRefData]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch when filters change
    void load(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, accountId, categoryId, dateFrom, dateTo, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch when the page changes
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette transaction ?")) return;
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    if (res.ok) {
      void load(page);
    } else {
      const data = (await res.json()) as { error?: string };
      alert(data.error ?? "Erreur lors de la suppression");
    }
  };

  const kindLabel = kind === "expense" ? "dépense" : "revenu";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold capitalize">
          {kind === "expense" ? "Dépenses" : "Revenus"}
        </h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowApplyRules(true)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Appliquer les règles d'import aux transactions sans catégorie"
          >
            Catégoriser
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Importer
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
        >
          <option value="">Tous les comptes</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          title="Du"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          title="Au"
        />

        <div className="flex gap-1">
          <input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setQ(qInput);
            }}
            placeholder="Rechercher…"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
          />
          <button
            onClick={() => setQ(qInput)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            🔍
          </button>
          {q && (
            <button
              onClick={() => {
                setQ("");
                setQInput("");
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-white shadow-sm overflow-x-auto dark:bg-zinc-900">
        {isLoading ? (
          <p className="p-6 text-sm text-zinc-500">Chargement…</p>
        ) : transactions.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">
            Aucune {kindLabel} trouvée.
          </p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Catégorie</th>
                <th className="px-4 py-3">Compte</th>
                <th className="px-4 py-3 text-right">Montant</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">{formatDate(t.date)}</td>
                  <td className="px-4 py-3 max-w-xs truncate">
                    {t.description}
                    {t.is_imported && (
                      <span className="ml-1 rounded bg-zinc-100 px-1 py-0.5 text-xs text-zinc-400">import</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {t.categories ? (
                      <span className="flex items-center gap-1">
                        <span
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: t.categories.color ?? CATEGORY_COLOR_FALLBACK }}
                        />
                        {t.categories.icon ? `${t.categories.icon} ` : ""}
                        {t.categories.name}
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{t.accounts?.name ?? "—"}</td>
                  <td
                    className={`px-4 py-3 text-right font-medium whitespace-nowrap ${
                      t.kind === "expense" ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {t.kind === "expense" ? "−" : "+"}
                    {formatAmount(t.amount_cents, t.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {!t.transfer_id ? (
                        <>
                          <button
                            onClick={() => setEditingTransaction(t)}
                            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                          >
                            Modifier
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Supprimer
                          </button>
                        </>
                      ) : (
                        <span className="text-xs text-zinc-400">Virement</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {/* Modals */}
      {showCreate && (
        <TransactionModal
          kind={kind}
          onSuccess={() => {
            setShowCreate(false);
            void load(1);
            setPage(1);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingTransaction && (
        <TransactionModal
          kind={kind}
          transactionId={editingTransaction.id}
          defaultValues={{
            account_id: editingTransaction.account_id,
            amount: String(Math.abs(editingTransaction.amount_cents) / 100),
            date: editingTransaction.date.slice(0, 10),
            description: editingTransaction.description,
            category_id: editingTransaction.category_id ?? "",
            notes: editingTransaction.notes ?? "",
          }}
          onSuccess={() => {
            setEditingTransaction(null);
            void load(page);
          }}
          onClose={() => setEditingTransaction(null)}
        />
      )}

      {showApplyRules && (
        <ApplyRulesModal
          kind={kind}
          onSuccess={() => {
            setShowApplyRules(false);
            void load(1);
            setPage(1);
          }}
          onClose={() => setShowApplyRules(false)}
        />
      )}

      {showImport && (
        <ImportModal
          kind={kind}
          onSuccess={() => {
            setShowImport(false);
            void load(1);
            setPage(1);
          }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
