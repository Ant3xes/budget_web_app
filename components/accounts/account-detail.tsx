"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronLeft, ChevronRight, MoreVertical, Pencil, Trash2 } from "lucide-react";

import { AccountModal } from "@/components/accounts/account-modal";
import { BalanceChart } from "@/components/accounts/balance-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { IncomeExpenseBarChart } from "@/components/dashboard/bar-chart";
import { ImportModal } from "@/components/import/import-modal";
import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pagination } from "@/components/ui/pagination";
import {
  computeDailyBalanceSeries,
  type BalanceSeriesTx,
} from "@/lib/accounts/compute-balance-series";
import { computeExpenseByCategory } from "@/lib/accounts/compute-expense-by-category";
import type { ExpenseByCategoryTx } from "@/lib/accounts/compute-expense-by-category";
import { ACCOUNT_TYPES } from "@/lib/constants";
import { formatEuros } from "@/lib/format";
import {
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

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });

// ─── Mini transaction table ────────────────────────────────────────────────

interface TxTableProps {
  title: string;
  transactions: Transaction[];
  emptyLabel: string;
  showSens?: boolean;
  amountColor: (tx: Transaction) => string;
}

const TX_PER_PAGE = 10;

function TxTable({ title, transactions, emptyLabel, showSens, amountColor }: TxTableProps) {
  const { t } = useLocale();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(transactions.length / TX_PER_PAGE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = transactions.slice((currentPage - 1) * TX_PER_PAGE, currentPage * TX_PER_PAGE);
  const operationLabel = t("accounts.detail.operationLabel");

  return (
    <div className="rounded-2xl bg-card shadow-sm ring-1 ring-foreground/10">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        {transactions.length > 0 && (
          <p className="mt-0.5 text-xs text-zinc-400">
            {transactions.length} {operationLabel}
            {transactions.length > 1 ? "s" : ""}
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
                <th className="px-3 py-2">{t("accounts.table.date")}</th>
                <th className="px-3 py-2">{t("accounts.table.description")}</th>
                <th className="px-3 py-2">{t("accounts.table.category")}</th>
                {showSens && <th className="px-3 py-2">{t("accounts.table.sens")}</th>}
                <th className="px-3 py-2 text-right">{t("accounts.table.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((tx) => (
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
                        {tx.kind === "transfer_credit" ? t("accounts.detail.incoming") : t("accounts.detail.outgoing")}
                      </span>
                    </td>
                  )}
                  <td className={`px-3 py-2 text-right text-xs font-medium ${amountColor(tx)}`}>
                    {tx.amount_cents >= 0 ? "+" : "−"}
                    {formatEuros(Math.abs(tx.amount_cents), tx.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            total={transactions.length}
            onPageChange={setPage}
            itemLabel={operationLabel}
            className="border-t border-zinc-100 px-4 py-2 dark:border-zinc-800"
          />
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
  const { t } = useLocale();
  const [period, setPeriod] = useState<Period>(() => parsePeriodParam(initialPeriod));
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const monthInputRef = useRef<HTMLInputElement>(null);

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

  // "2a" has no key in periodSelector.presets (only "1m","3m","6m","1a","tout"
  // are defined there — see AGENTS.md scope for this task), so it falls back
  // to a dedicated key in the accounts dictionary instead.
  const presetLabel = (preset: PeriodPreset) =>
    preset === "2a" ? t("accounts.detail.twoYearsPreset") : t(`periodSelector.presets.${preset}`);

  const handleDelete = async () => {
    setIsDeleting(true);
    await fetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: account.id }),
    });
    router.push("/accounts");
    router.refresh();
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{account.name}</h1>
          <span className="mt-1 inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {(ACCOUNT_TYPES as readonly string[]).includes(account.type)
              ? t(`accounts.types.${account.type}`)
              : account.type}
          </span>
          <p
            className={`mt-3 text-3xl font-semibold tracking-tight ${
              balanceCents >= 0 ? "text-zinc-900 dark:text-zinc-100" : "text-red-600"
            }`}
          >
            {formatEuros(balanceCents, account.currency)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            {t("accounts.list.importButton")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  aria-label={t("accounts.detail.optionsLabel")}
                >
                  <MoreVertical />
                </Button>
              }
            />
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setEditModalOpen(true)}>
                <Pencil />
                {t("common.actions.edit")}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                disabled={isDeleting}
              >
                <Trash2 />
                {t("common.actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Shared period control */}
      <Card className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {PRESET_ORDER.map((preset) => (
            <Button
              key={preset}
              size="xs"
              variant={isPresetActive(preset) ? "default" : "ghost"}
              onClick={() => selectPreset(preset)}
            >
              {presetLabel(preset)}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("accounts.detail.month")}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => shiftMonth(-1)}
            aria-label={t("accounts.detail.prevMonth")}
          >
            <ChevronLeft />
          </Button>
          <Button
            type="button"
            variant={period.type === "month" ? "default" : "ghost"}
            size="sm"
            className="min-w-[9rem] capitalize"
            onClick={() => applyPeriod({ type: "month", month: selectedMonth })}
          >
            {toMonthLabel(selectedMonth)}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => shiftMonth(1)}
            aria-label={t("accounts.detail.nextMonth")}
          >
            <ChevronRight />
          </Button>
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                const input = monthInputRef.current;
                if (input?.showPicker) {
                  input.showPicker();
                } else {
                  input?.focus();
                }
              }}
              aria-label={t("accounts.detail.pickMonth")}
            >
              <Calendar />
            </Button>
            <input
              ref={monthInputRef}
              type="month"
              value={selectedMonth}
              onChange={(e) => {
                if (e.target.value) applyPeriod({ type: "month", month: e.target.value });
              }}
              className="absolute inset-0 h-full w-full pointer-events-none opacity-0"
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="space-y-4">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            {t("accounts.detail.balanceEvolution")}
          </h2>
          <BalanceChart data={visibleBalanceData} currency={account.currency} />
        </Card>

        <div className="grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {t("accounts.detail.incomeVsExpense")}
            </h2>
            <IncomeExpenseBarChart data={visibleIncomeExpenseData} height={200} />
          </Card>

          <Card className="p-4">
            <h2 className="mb-3 text-sm font-medium text-muted-foreground">
              {t("accounts.detail.expenseByCategory")}
            </h2>
            {/* Taller than the bar chart next to it: the legend needs room
                to wrap onto several rows without being clipped when the
                account has many categories (unlike a fixed axis chart, this
                one's content height genuinely depends on the data). */}
            <DonutChart data={donutData} height={280} />
          </Card>
        </div>
      </div>

      {/* Transaction lists for the same period */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TxTable
          title={t("accounts.detail.expenses")}
          transactions={expenses}
          emptyLabel={t("accounts.detail.noExpenses")}
          amountColor={() => "text-red-500"}
        />
        <TxTable
          title={t("accounts.detail.incomes")}
          transactions={incomes}
          emptyLabel={t("accounts.detail.noIncomes")}
          amountColor={() => "text-green-600"}
        />
      </div>

      <TxTable
        title={t("accounts.detail.transfers")}
        transactions={transfers}
        emptyLabel={t("accounts.detail.noTransfers")}
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

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={t("accounts.detail.deleteConfirm", { name: account.name })}
        onConfirm={() => {
          setDeleteDialogOpen(false);
          void handleDelete();
        }}
        isConfirming={isDeleting}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
      />
    </section>
  );
}
