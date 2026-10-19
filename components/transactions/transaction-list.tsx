"use client";

import { useState, type ReactNode } from "react";
import { Search, Split, Trash2, X } from "lucide-react";

import { ApplyRulesModal } from "@/components/transactions/apply-rules-modal";
import { AccountModal } from "@/components/accounts/account-modal";
import { ImportButton } from "@/components/import/import-button";
import { ImportModal } from "@/components/import/import-modal";
import { ShareTransactionModal } from "@/components/transactions/share-transaction-modal";
import { TransactionModal } from "@/components/transactions/transaction-modal";
import { TransferModal } from "@/components/transfers/transfer-modal";
import { CategoryBadge } from "@/components/category-badge";
import { apiErrorMessage } from "@/lib/api/error-message";
import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FilterSheet } from "@/components/ui/filter-sheet";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { useTransactionList } from "@/components/transactions/use-transaction-list";
import { transactionAmounts, transactionEditValues } from "@/lib/transactions/list-presentation";
import { getShare, type Transaction, type TransactionListInitial } from "@/lib/transactions/list-types";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";
import { resolveCategoryName } from "@/lib/i18n/category-name";
import { formatDate, formatEuros } from "@/lib/format";

export function TransactionList({ spaceKind = "personal", initial }: { spaceKind?: "personal" | "shared"; initial?: TransactionListInitial }) {
  const { t } = useLocale();
  const { transactions, total, page, setPage, isLoading, type, setType, accountId, setAccountId, categorySelection, setCategorySelection, dateFrom, setDateFrom, dateTo, setDateTo, q, setQ, qInput, setQInput, accounts, accountsLoaded, categories, spaceNames, totalPages, canShare, load, loadRefData } = useTransactionList(spaceKind, initial);
  const [showCreateAccount, setShowCreateAccount] = useState(false);
  // Modals
  const [createKind, setCreateKind] = useState<"expense" | "income" | "transfer" | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showApplyRules, setShowApplyRules] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [sharingTransaction, setSharingTransaction] = useState<Transaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
      setDeleteError(apiErrorMessage(data?.error, t("transactions.errors.deleteGeneric"), t));
    }
  };

  const editKind: "expense" | "income" | "transfer" = editingTransaction?.transfer_id
    ? "transfer"
    : (editingTransaction?.kind === "income" ? "income" : "expense");

  // Category options for the filter dropdown follow the type filter (a
  // transfer has no category, so the dropdown itself is hidden for that type
  // — see the type filter buttons below, which also reset categorySelection
  // whenever type changes so a stale choice never leaks across tabs).
  const filterCategories = categories.filter((c) => type === "all" || c.kind === type);

  const { amountClass, amountText, reimbursementNote } = transactionAmounts(t);

  // Whole row opens the edit modal on click (issue 114). The row itself is not
  // an interactive role: it contains the share and delete buttons and nested
  // interactive controls are an a11y error. Keyboard and screen-reader users
  // get a real button on the description instead (see openButton).
  const rowProps = (tx: Transaction) => ({
    onClick: () => setEditingTransaction(tx),
  });
  const openButton = (tx: Transaction, children: ReactNode) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setEditingTransaction(tx);
      }}
      className="min-w-0 max-w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
  const rowClass =
    "cursor-pointer transition-colors hover:bg-muted/50";

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
    // Clicks inside the action cluster never reach the row (issue 114).
    <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
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

  // Filter controls, extracted so they can be rendered once in the desktop
  // bar and once (stacked full-width) inside the mobile `FilterSheet` —
  // same state/handlers either way, just two places in the render tree.
  const typeToggle = (
    <div className="flex overflow-hidden rounded-lg border border-border text-sm">
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
  );

  const accountSelect = (
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
  );

  const categorySelect = type !== "transfer" && (
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
  );

  const dateFromInput = (
    <Input
      type="date"
      value={dateFrom}
      onChange={(e) => setDateFrom(e.target.value)}
      className="w-full md:w-auto"
      aria-label={t("transactions.list.dateFrom")}
      title={t("transactions.list.dateFrom")}
    />
  );

  const dateToInput = (
    <Input
      type="date"
      value={dateTo}
      onChange={(e) => setDateTo(e.target.value)}
      className="w-full md:w-auto"
      aria-label={t("transactions.list.dateTo")}
      title={t("transactions.list.dateTo")}
    />
  );

  const searchBlock = (
    <div className="flex min-w-0 flex-1 gap-1 md:flex-none">
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
  );

  const activeFilterCount = [
    type !== "all",
    !!accountId,
    type !== "transfer" && !!categorySelection,
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{t("transactions.list.title")}</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setShowApplyRules(true)} title={t("transactions.list.categorizeTitle")}>
            {t("transactions.list.categorize")}
          </Button>
          <ImportButton
            label={t("transactions.list.import")}
            hasAccount={!accountsLoaded || accounts.length > 0}
            onImport={() => setShowImport(true)}
            onCreateAccount={() => setShowCreateAccount(true)}
          />
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

      {/* Filters — desktop */}
      <Card className="hidden gap-2 p-3 md:flex md:flex-row md:flex-wrap md:items-center md:gap-3">
        {typeToggle}
        {accountSelect}
        {categorySelect}
        {dateFromInput}
        {dateToInput}
        {searchBlock}
      </Card>

      {/* Filters — mobile: search stays front-and-center, the rest lives in the sheet */}
      <div className="flex items-center gap-2 md:hidden">
        {searchBlock}
        <FilterSheet
          triggerLabelKey="common.filters.trigger"
          titleKey="common.filters.title"
          activeCount={activeFilterCount}
        >
          {typeToggle}
          {accountSelect}
          {categorySelect}
          <div className="flex gap-2">
            {dateFromInput}
            {dateToInput}
          </div>
        </FilterSheet>
      </div>

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
                <li key={tx.id} {...rowProps(tx)} className={`rounded-2xl bg-card p-3 ring-1 ring-foreground/10 ${rowClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 break-words text-sm font-medium">
                      {openButton(tx, tx.description)}
                      {tx.is_imported && (
                        <span className="ml-1 rounded bg-muted px-1 py-0.5 text-xs font-normal text-muted-foreground">
                          {t("transactions.list.imported")}
                        </span>
                      )}
                      {shareBadge(tx)}
                    </p>
                    <p className={`shrink-0 text-sm font-semibold whitespace-nowrap ${amountClass(tx)}`}>
                      {amountText(tx)}
                      {reimbursementNote(tx) && (
                        <span className="block text-xs font-normal text-muted-foreground">{reimbursementNote(tx)}</span>
                      )}
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
                  <tr key={tx.id} {...rowProps(tx)} className={`border-b border-border ${rowClass}`}>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(tx.date)}</td>
                    <td className="px-4 py-3 max-w-xs truncate">
                      {openButton(tx, tx.description)}
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
                      {reimbursementNote(tx) && (
                        <span className="block text-xs font-normal text-muted-foreground">{reimbursementNote(tx)}</span>
                      )}
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

      {editingTransaction && (
        <TransactionModal
          kind={editKind}
          transactionId={editingTransaction.id}
          defaultValues={transactionEditValues(editingTransaction)}
          rawLabel={editingTransaction.raw_import_data?.raw_label ?? null}
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

      {showCreateAccount && (
        <AccountModal
          onClose={() => setShowCreateAccount(false)}
          onSuccess={() => {
            setShowCreateAccount(false);
            void loadRefData();
          }}
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
