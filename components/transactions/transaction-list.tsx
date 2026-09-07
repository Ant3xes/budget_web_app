"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Pencil, Search, Trash2, X } from "lucide-react";

import { ApplyRulesModal } from "@/components/transactions/apply-rules-modal";
import { ImportModal } from "@/components/import/import-modal";
import { TransactionModal } from "@/components/transactions/transaction-modal";
import { TransferModal } from "@/components/transfers/transfer-modal";
import { CategoryBadge } from "@/components/category-badge";
import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
import { resolveCategoryName } from "@/lib/i18n/category-name";
import { formatDate, formatEuros } from "@/lib/format";

type Transaction = {
  id: string;
  kind: "expense" | "income" | "transfer_debit" | "transfer_credit";
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
  to_account: { name: string } | null;
};

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string; is_default?: boolean; translation_key?: string | null };

// UI-level type filter — "transfer" covers both transfer_debit/transfer_credit
// (the API returns one representative row per transfer pair, see
// app/api/transactions/route.ts).
type TypeFilter = "all" | "expense" | "income" | "transfer";
const UNCATEGORIZED = "__uncategorized__";

const PER_PAGE = 25;

export function TransactionList() {
  const { t } = useLocale();
  // Pre-filter from a drill-down link (e.g. the dashboard's "voir tout"
  // buttons), read once on mount via useSearchParams rather than a page-level
  // prop, since /transactions doesn't need to thread a searchParams prop
  // through just for this.
  const searchParams = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [type, setType] = useState<TypeFilter>(() => {
    const t = searchParams.get("type");
    return t === "expense" || t === "income" || t === "transfer" ? t : "all";
  });
  const [accountId, setAccountId] = useState("");
  const [categorySelection, setCategorySelection] = useState(() => searchParams.get("category_id") ?? "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");

  // Reference data
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  // Modals
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [createKind, setCreateKind] = useState<"expense" | "income" | "transfer" | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showApplyRules, setShowApplyRules] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PER_PAGE);
  const isUncategorized = categorySelection === UNCATEGORIZED;

  const loadRefData = useCallback(async () => {
    const [accRes, catRes] = await Promise.all([fetch("/api/accounts"), fetch("/api/categories")]);
    if (accRes.ok) {
      const d = (await accRes.json()) as { accounts: Account[] };
      setAccounts(d.accounts ?? []);
    }
    if (catRes.ok) {
      const d = (await catRes.json()) as { categories: Category[] };
      setCategories(d.categories ?? []);
    }
  }, []);

  const load = useCallback(
    async (p = page) => {
      setIsLoading(true);
      const params = new URLSearchParams({ page: String(p), per_page: String(PER_PAGE) });
      if (type !== "all") params.set("kind", type);
      if (accountId) params.set("account_id", accountId);
      if (isUncategorized) params.set("uncategorized", "true");
      else if (categorySelection) params.set("category_id", categorySelection);
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
    [type, page, accountId, categorySelection, isUncategorized, dateFrom, dateTo, q],
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
  }, [type, accountId, categorySelection, isUncategorized, dateFrom, dateTo, q]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refetch when the page changes
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleDelete = async () => {
    if (!deletingTransaction) return;
    setIsDeleting(true);
    setDeleteError(null);
    const url = deletingTransaction.transfer_id
      ? `/api/transfers/${deletingTransaction.transfer_id}`
      : `/api/transactions/${deletingTransaction.id}`;
    const res = await fetch(url, { method: "DELETE" });
    setIsDeleting(false);
    if (res.ok) {
      setDeletingTransaction(null);
      void load(page);
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setDeleteError(data?.error ?? t("transactions.errors.deleteGeneric"));
    }
  };

  const editKind: "expense" | "income" | null =
    editingTransaction && !editingTransaction.transfer_id ? (editingTransaction.kind as "expense" | "income") : null;

  // Category options for the filter dropdown follow the type filter (a
  // transfer has no category, so the dropdown itself is hidden for that type
  // — see the type filter buttons below, which also reset categorySelection
  // whenever type changes so a stale choice never leaks across tabs).
  const filterCategories = categories.filter((c) => type === "all" || c.kind === type);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("transactions.list.title")}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowApplyRules(true)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title={t("transactions.list.categorizeTitle")}
          >
            {t("transactions.list.categorize")}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("transactions.list.import")}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowTypePicker((v) => !v)}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-white dark:text-zinc-900"
            >
              {t("transactions.list.add")}
            </button>
            {showTypePicker && (
              <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                {(["expense", "income", "transfer"] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => {
                      setCreateKind(k);
                      setShowTypePicker(false);
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    {t(`transactions.list.addType.${k}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex rounded-md border border-zinc-200 text-sm dark:border-zinc-700 overflow-hidden">
          {(["all", "expense", "income", "transfer"] as const).map((tp) => (
            <button
              key={tp}
              onClick={() => {
                setType(tp);
                // A category only applies within its own kind (and a
                // transfer has none at all) — drop any selection made under
                // a different tab instead of silently filtering by it.
                setCategorySelection("");
              }}
              className={`px-3 py-1.5 transition-colors ${
                type === tp
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "hover:bg-zinc-50 text-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              {t(`transactions.list.type.${tp}`)}
            </button>
          ))}
        </div>

        <div className="relative inline-block">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="appearance-none rounded-md border border-zinc-300 px-3 py-1.5 pr-8 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
          >
            <option value="">{t("transactions.list.allAccounts")}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
        </div>

        {type !== "transfer" && (
          <div className="relative inline-block">
            <select
              value={categorySelection}
              onChange={(e) => setCategorySelection(e.target.value)}
              className="appearance-none rounded-md border border-zinc-300 px-3 py-1.5 pr-8 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
            >
              <option value="">{t("transactions.list.allCategories")}</option>
              <option value={UNCATEGORIZED}>{t("transactions.list.uncategorizedOption")}</option>
              {filterCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {resolveCategoryName(c, t)}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400" />
          </div>
        )}

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          title={t("transactions.list.dateFrom")}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100"
          title={t("transactions.list.dateTo")}
        />

        <div className="flex gap-1">
          <input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setQ(qInput);
            }}
            placeholder={t("transactions.list.searchPlaceholder")}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
          />
          <button
            onClick={() => setQ(qInput)}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            aria-label={t("transactions.list.search")}
          >
            <Search className="h-4 w-4" />
          </button>
          {q && (
            <button
              onClick={() => {
                setQ("");
                setQInput("");
              }}
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label={t("transactions.list.clearSearch")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-white shadow-sm overflow-x-auto dark:bg-zinc-900">
        {isLoading ? (
          <p className="p-6 text-sm text-zinc-500">{t("common.state.loading")}</p>
        ) : transactions.length === 0 ? (
          <p className="p-6 text-sm text-zinc-400">{t("transactions.list.empty")}</p>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-left text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                <th className="px-4 py-3">{t("transactions.list.date")}</th>
                <th className="px-4 py-3">{t("transactions.list.description")}</th>
                <th className="px-4 py-3">{t("transactions.list.category")}</th>
                <th className="px-4 py-3">{t("transactions.list.account")}</th>
                <th className="px-4 py-3 text-left">{t("transactions.list.amount")}</th>
                <th className="px-4 py-3">{t("transactions.list.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const isTransfer = !!tx.transfer_id;
                return (
                  <tr key={tx.id} className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                    <td className="px-4 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3 max-w-xs truncate">
                      {tx.description}
                      {tx.is_imported && (
                        <span className="ml-1 rounded bg-zinc-100 px-1 py-0.5 text-xs text-zinc-400">{t("transactions.list.imported")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isTransfer ? (
                        <span className="text-xs text-blue-700 dark:text-blue-300">
                          {tx.accounts?.name ?? "—"} → {tx.to_account?.name ?? "—"}
                        </span>
                      ) : tx.categories ? (
                        <CategoryBadge name={tx.categories.name} color={tx.categories.color} icon={tx.categories.icon} />
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{tx.accounts?.name ?? "—"}</td>
                    <td
                      className={`px-4 py-3 text-left font-medium whitespace-nowrap ${
                        isTransfer
                          ? "text-blue-600 dark:text-blue-400"
                          : tx.kind === "expense"
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {!isTransfer && (tx.kind === "expense" ? "−" : "+")}
                      {formatEuros(Math.abs(tx.amount_cents), tx.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingTransaction(tx)}
                          aria-label={t("common.actions.edit")}
                          title={t("common.actions.edit")}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          variant="destructive"
                          size="icon-sm"
                          onClick={() => setDeletingTransaction(tx)}
                          aria-label={t("common.actions.delete")}
                          title={t("common.actions.delete")}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPageChange={setPage} />

      {/* Modals */}
      {createKind === "transfer" && (
        <TransferModal
          onSuccess={() => {
            setCreateKind(null);
            void load(1);
            setPage(1);
          }}
          onClose={() => setCreateKind(null)}
        />
      )}
      {(createKind === "expense" || createKind === "income") && (
        <TransactionModal
          kind={createKind}
          onSuccess={() => {
            setCreateKind(null);
            void load(1);
            setPage(1);
          }}
          onClose={() => setCreateKind(null)}
        />
      )}

      {editingTransaction && !editingTransaction.transfer_id && editKind && (
        <TransactionModal
          kind={editKind}
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

      {editingTransaction && editingTransaction.transfer_id && (
        <TransferModal
          transferId={editingTransaction.transfer_id}
          defaultValues={{
            amount: String(Math.abs(editingTransaction.amount_cents) / 100),
            date: editingTransaction.date.slice(0, 10),
            description: editingTransaction.description,
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
          onSuccess={() => {
            setShowImport(false);
            void load(1);
            setPage(1);
          }}
          onClose={() => setShowImport(false)}
        />
      )}

      <AlertDialog
        open={deletingTransaction !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingTransaction(null);
            setDeleteError(null);
          }
        }}
        title={
          deletingTransaction?.transfer_id
            ? t("transactions.transfers.deleteConfirmTitle")
            : t("transactions.list.deleteConfirmTitle")
        }
        description={
          deleteError
            ? deleteError
            : deletingTransaction?.transfer_id
              ? t("transactions.transfers.deleteConfirmDescription", {
                  date: formatDate(deletingTransaction.date),
                  amount: formatEuros(Math.abs(deletingTransaction.amount_cents), deletingTransaction.currency),
                })
              : deletingTransaction
                ? t("transactions.list.deleteConfirmDescription", { description: deletingTransaction.description })
                : undefined
        }
        onConfirm={handleDelete}
        isConfirming={isDeleting}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
      />
    </div>
  );
}
