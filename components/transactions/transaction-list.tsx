"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Pencil, Search, Split, Trash2, X } from "lucide-react";

import { ApplyRulesModal } from "@/components/transactions/apply-rules-modal";
import { ImportModal } from "@/components/import/import-modal";
import { ShareTransactionModal } from "@/components/transactions/share-transaction-modal";
import { TransactionModal } from "@/components/transactions/transaction-modal";
import { TransferModal } from "@/components/transfers/transfer-modal";
import { CategoryBadge } from "@/components/category-badge";
import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";
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
  // PostgREST returns an object (1:1) or an array depending on the relation
  // cardinality; normalised by getShare().
  shared_expenses?: SharedRef | SharedRef[] | null;
};

type SharedRef = {
  id: string;
  space_id: string;
  category_id: string | null;
  paid_by?: string;
  shares?: Record<string, number>;
};

const getShare = (tx: Transaction): SharedRef | null => {
  const raw = tx.shared_expenses;
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) ?? null;
};

type Account = { id: string; name: string };
type Category = { id: string; name: string; kind: string; is_default?: boolean; translation_key?: string | null };

// UI-level type filter — "transfer" covers both transfer_debit/transfer_credit
// (the API returns one representative row per transfer pair, see
// app/api/transactions/route.ts).
type TypeFilter = "all" | "expense" | "income" | "transfer";

const PER_PAGE = 25;

export function TransactionList({ spaceKind = "personal" }: { spaceKind?: "personal" | "shared" }) {
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
  const [createKind, setCreateKind] = useState<"expense" | "income" | "transfer" | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showApplyRules, setShowApplyRules] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [sharingTransaction, setSharingTransaction] = useState<Transaction | null>(null);
  const [spaceNames, setSpaceNames] = useState<Record<string, string>>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const totalPages = Math.ceil(total / PER_PAGE);
  const isUncategorized = categorySelection === UNCATEGORIZED_CATEGORY_ID;

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

  const canShare = spaceKind === "personal";

  useEffect(() => {
    if (!canShare) return;
    const loadSpaces = async () => {
      const res = await fetch("/api/spaces");
      if (!res.ok) return;
      const d = (await res.json()) as { spaces: { id: string; name: string }[] };
      setSpaceNames(Object.fromEntries((d.spaces ?? []).map((s) => [s.id, s.name])));
    };
    void loadSpaces();
  }, [canShare]);

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

  const amountClass = (tx: Transaction) =>
    tx.transfer_id ? "text-blue-600 dark:text-blue-400" : tx.kind === "expense" ? "text-expense" : "text-income";
  const amountText = (tx: Transaction) =>
    `${tx.transfer_id ? "" : tx.kind === "expense" ? "−" : "+"}${formatEuros(Math.abs(tx.amount_cents), tx.currency)}`;

  const shareBadge = (tx: Transaction) => {
    const share = canShare ? getShare(tx) : null;
    if (!share) return null;
    const name = spaceNames[share.space_id];
    return (
      <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 text-xs font-normal text-primary">
        {name ? t("sharedExpenses.row.badgeIn", { space: name }) : t("sharedExpenses.row.badge")}
      </span>
    );
  };

  const renderActions = (tx: Transaction) => {
    const canShareRow = canShare && tx.kind === "expense" && !tx.transfer_id;
    const shared = canShareRow && getShare(tx) !== null;
    const shareLabel = t(shared ? "sharedExpenses.row.manage" : "sharedExpenses.row.share");
    return (
    <div className="flex shrink-0 gap-1">
      {canShareRow && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setSharingTransaction(tx)}
          aria-label={shareLabel}
          title={shareLabel}
        >
          <Split />
        </Button>
      )}
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
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("transactions.list.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowApplyRules(true)} title={t("transactions.list.categorizeTitle")}>
            {t("transactions.list.categorize")}
          </Button>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            {t("transactions.list.import")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className={buttonVariants({ variant: "default" })}>
              {t("transactions.list.add")}
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {(["expense", "income", "transfer"] as const).map((k) => (
                <DropdownMenuItem key={k} onClick={() => setCreateKind(k)}>
                  {t(`transactions.list.addType.${k}`)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters */}
      <Card className="grid grid-cols-2 gap-2 p-3 md:flex md:flex-row md:flex-wrap md:items-center md:gap-3">
        <div className="col-span-2 flex overflow-hidden rounded-lg border border-border text-sm md:col-span-1">
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
              className={`flex-1 px-3 py-2.5 transition-colors md:flex-none md:py-1.5 ${
                type === tp ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {t(`transactions.list.type.${tp}`)}
            </button>
          ))}
        </div>

        <Select
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          aria-label={t("transactions.list.account")}
          className="w-full md:w-auto"
        >
          <option value="">{t("transactions.list.allAccounts")}</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>

        {type !== "transfer" && (
          <Select
            value={categorySelection}
            onChange={(e) => setCategorySelection(e.target.value)}
            aria-label={t("transactions.list.category")}
            className="w-full md:w-auto"
          >
            <option value="">{t("transactions.list.allCategories")}</option>
            <option value={UNCATEGORIZED_CATEGORY_ID}>{t("transactions.list.uncategorizedOption")}</option>
            {filterCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {resolveCategoryName(c, t)}
              </option>
            ))}
          </Select>
        )}

        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-full md:w-auto"
          aria-label={t("transactions.list.dateFrom")}
          title={t("transactions.list.dateFrom")}
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-full md:w-auto"
          aria-label={t("transactions.list.dateTo")}
          title={t("transactions.list.dateTo")}
        />

        <div className="col-span-2 flex gap-1 md:col-span-1">
          <Input
            type="text"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setQ(qInput);
            }}
            placeholder={t("transactions.list.searchPlaceholder")}
            className="min-w-0 flex-1 md:w-auto md:flex-none"
          />
          <Button variant="outline" size="icon" onClick={() => setQ(qInput)} aria-label={t("transactions.list.search")}>
            <Search />
          </Button>
          {q && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setQ("");
                setQInput("");
              }}
              aria-label={t("transactions.list.clearSearch")}
            >
              <X />
            </Button>
          )}
        </div>
      </Card>

      {isLoading || transactions.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm ring-1 ring-foreground/10">
          <p className="p-6 text-sm text-muted-foreground">
            {isLoading ? t("common.state.loading") : t("transactions.list.empty")}
          </p>
        </div>
      ) : (
        <>
          {/* Cards (< md) */}
          <ul className="space-y-2 md:hidden">
            {transactions.map((tx) => {
              const isTransfer = !!tx.transfer_id;
              return (
                <li key={tx.id} className="rounded-2xl bg-card p-3 ring-1 ring-foreground/10">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 break-words text-sm font-medium">
                      {tx.description}
                      {tx.is_imported && (
                        <span className="ml-1 rounded bg-muted px-1 py-0.5 text-xs font-normal text-muted-foreground">
                          {t("transactions.list.imported")}
                        </span>
                      )}
                      {shareBadge(tx)}
                    </p>
                    <p className={`shrink-0 text-sm font-semibold whitespace-nowrap ${amountClass(tx)}`}>
                      {amountText(tx)}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap">{formatDate(tx.date)}</span>
                      {isTransfer ? (
                        <span className="text-blue-700 dark:text-blue-300">
                          {tx.accounts?.name ?? "—"} → {tx.to_account?.name ?? "—"}
                        </span>
                      ) : (
                        <>
                          {tx.categories && (
                            <CategoryBadge name={tx.categories.name} color={tx.categories.color} icon={tx.categories.icon} />
                          )}
                          <span className="truncate">{tx.accounts?.name ?? "—"}</span>
                        </>
                      )}
                    </div>
                    {renderActions(tx)}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Table (>= md) */}
          <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card shadow-sm ring-1 ring-foreground/10 md:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
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
                  <tr key={tx.id} className="border-b border-border hover:bg-muted/50">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3 max-w-xs truncate">
                      {tx.description}
                      {tx.is_imported && (
                        <span className="ml-1 rounded bg-muted px-1 py-0.5 text-xs text-muted-foreground">
                          {t("transactions.list.imported")}
                        </span>
                      )}
                      {shareBadge(tx)}
                    </td>
                    <td className="px-4 py-3">
                      {isTransfer ? (
                        <span className="text-xs text-blue-700 dark:text-blue-300">
                          {tx.accounts?.name ?? "—"} → {tx.to_account?.name ?? "—"}
                        </span>
                      ) : tx.categories ? (
                        <CategoryBadge name={tx.categories.name} color={tx.categories.color} icon={tx.categories.icon} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{tx.accounts?.name ?? "—"}</td>
                    <td className={`px-4 py-3 text-left font-medium whitespace-nowrap ${amountClass(tx)}`}>
                      {amountText(tx)}
                    </td>
                    <td className="px-4 py-3">
                      {renderActions(tx)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </>
      )}

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

      {sharingTransaction && (
        <ShareTransactionModal
          transactionId={sharingTransaction.id}
          amountCents={sharingTransaction.amount_cents}
          currency={sharingTransaction.currency}
          existing={(() => {
            const share = getShare(sharingTransaction);
            return share
              ? {
                  id: share.id,
                  spaceId: share.space_id,
                  categoryId: share.category_id,
                  // The payer's saved share, so editing starts from it and not from the space default.
                  payerSharePercent: share.paid_by ? share.shares?.[share.paid_by] : undefined,
                }
              : undefined;
          })()}
          onSuccess={() => {
            setSharingTransaction(null);
            void load(page);
          }}
          onClose={() => setSharingTransaction(null)}
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
          spaceKind={spaceKind}
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
