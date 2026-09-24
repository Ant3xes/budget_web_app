"use client";

import { useEffect, useRef, useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";

import { useLocale } from "@/components/locale-provider";
import { Modal } from "@/components/ui/modal";
import { resolveCategoryName } from "@/lib/i18n/category-name";

type ShareSuggestion = {
  space_id: string;
  space_name: string;
  category_id: string | null;
  payer_share_percent: number;
};

type PreviewRowRaw = {
  hash: string;
  date: string;
  description: string;
  amount_cents: number;
  kind: "expense" | "income";
  suggested_category_id: string | null;
  is_transfer_candidate: boolean;
  is_duplicate: boolean;
  suggested_share?: ShareSuggestion | null;
};

type PreviewRow = PreviewRowRaw & { rowId: string };

type Category = {
  id: string;
  name: string;
  kind: string;
  icon: string | null;
  is_default?: boolean;
  translation_key?: string | null;
};
type Account = { id: string; name: string };

interface ImportModalProps {
  defaultAccountId?: string;
  /** The shared column is only offered from a personal space. */
  spaceKind?: "personal" | "shared";
  onSuccess: () => void;
  onClose: () => void;
}

// Import is segmented in 3 parts to validate one type of data at a time,
// mirroring how Comptes already validates data step by step — Dépenses,
// Revenus, then Virements (rows flagged as a transfer, by the parser or
// manually, move here instead of appearing inline in the other two steps).
type Step = "upload" | "preview_expense" | "preview_income" | "preview_transfer" | "done";

const formatAmount = (cents: number) => {
  const sign = cents < 0 ? "−" : "+";
  return `${sign}${(Math.abs(cents) / 100).toFixed(2)} €`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export function ImportModal({ defaultAccountId, spaceKind = "personal", onSuccess, onClose }: ImportModalProps) {
  const { t } = useLocale();
  const [step, setStep] = useState<Step>("upload");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(defaultAccountId ?? "");
  const [expensePreview, setExpensePreview] = useState<PreviewRow[]>([]);
  const [incomePreview, setIncomePreview] = useState<PreviewRow[]>([]);
  const [isTransfer, setIsTransfer] = useState<Record<string, boolean>>({}); // hash -> treat as transfer
  const [transferAccountMap, setTransferAccountMap] = useState<Record<string, string>>({}); // hash -> counterpart account_id
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({}); // hash -> category_id
  const [checked, setChecked] = useState<Record<string, boolean>>({}); // hash -> selected
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [sharedCount, setSharedCount] = useState<number | null>(null);
  const [shareMap, setShareMap] = useState<Record<string, ShareSuggestion | null>>({}); // rowId -> share
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const [accRes, catRes] = await Promise.all([fetch("/api/accounts"), fetch("/api/categories")]);
      if (accRes.ok) {
        const d = (await accRes.json()) as { accounts: Account[] };
        setAccounts(d.accounts ?? []);
        if (d.accounts.length > 0) {
          const preferred =
            defaultAccountId && d.accounts.some((a) => a.id === defaultAccountId)
              ? defaultAccountId
              : d.accounts[0]!.id;
          setSelectedAccountId(preferred);
        }
      }
      if (catRes.ok) {
        const d = (await catRes.json()) as { categories: Category[] };
        setCategories(d.categories ?? []);
      }
    };
    void load();
  }, [defaultAccountId]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError(t("transactions.importModal.selectFileError"));
      return;
    }
    if (!selectedAccountId) {
      setError(t("transactions.importModal.selectAccountError"));
      return;
    }

    setError(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/import/preview", { method: "POST", body: formData });
    setIsLoading(false);

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? t("transactions.importModal.parseError"));
      return;
    }

    const data = (await res.json()) as { preview: PreviewRowRaw[] };
    if (data.preview.length === 0) {
      setError(t("transactions.importModal.noTransactions"));
      return;
    }

    const expenses = data.preview
      .filter((r) => r.kind === "expense")
      .map((r, i): PreviewRow => ({ ...r, rowId: `e_${i}` }));
    const incomes = data.preview
      .filter((r) => r.kind === "income")
      .map((r, i): PreviewRow => ({ ...r, rowId: `i_${i}` }));
    setExpensePreview(expenses);
    setIncomePreview(incomes);

    const initCats: Record<string, string> = {};
    const initChecked: Record<string, boolean> = {};
    const initTransfer: Record<string, boolean> = {};
    const initShare: Record<string, ShareSuggestion | null> = {};
    for (const row of [...expenses, ...incomes]) {
      initCats[row.rowId] = row.suggested_category_id ?? "";
      initChecked[row.rowId] = !row.is_duplicate;
      initTransfer[row.rowId] = row.is_transfer_candidate;
      if (row.kind === "expense") {
        initShare[row.rowId] = spaceKind === "personal" ? (row.suggested_share ?? null) : null;
      }
    }
    setShareMap(initShare);
    setCategoryMap(initCats);
    setChecked(initChecked);
    setIsTransfer(initTransfer);
    setTransferAccountMap({});
    setStep("preview_expense");
  };

  const handleConfirm = async () => {
    const allRows = [...expensePreview, ...incomePreview];
    const selected = allRows.filter((r) => checked[r.rowId]);
    if (selected.length === 0) {
      setError(t("transactions.importModal.noTransactionSelected"));
      return;
    }

    setError(null);
    setIsLoading(true);

    const shareFor = (r: PreviewRow) => {
      const share = shareMap[r.rowId];
      if (spaceKind !== "personal" || !share) return undefined;
      if (r.kind !== "expense" || r.is_duplicate || isTransfer[r.rowId]) return undefined;
      return {
        space_id: share.space_id,
        category_id: share.category_id,
        payer_share_percent: share.payer_share_percent,
      };
    };

    const transactions = selected.map((r) => ({
      hash: r.hash,
      date: r.date,
      description: r.description,
      amount_cents: r.amount_cents,
      kind: isTransfer[r.rowId] ? "transfer" as const : r.kind,
      category_id: isTransfer[r.rowId] ? null : (categoryMap[r.rowId] || null),
      transfer_account_id: isTransfer[r.rowId] ? (transferAccountMap[r.rowId] || null) : undefined,
      share: shareFor(r),
    }));

    const res = await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: selectedAccountId, transactions }),
    });

    setIsLoading(false);

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? t("transactions.importModal.importError"));
      return;
    }

    const data = (await res.json()) as { imported: number; shared?: number };
    setImportedCount(data.imported);
    setSharedCount(typeof data.shared === "number" ? data.shared : null);
    setStep("done");
  };

  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const incomeCategories = categories.filter((c) => c.kind === "income");
  const isPreviewKindStep = step === "preview_expense" || step === "preview_income";
  const currentPreview = step === "preview_expense" ? expensePreview : incomePreview;
  const currentCategories = step === "preview_expense" ? expenseCategories : incomeCategories;
  // Rows marked as a transfer move out of their expense/income step into the
  // dedicated Virements step below, instead of being toggled inline.
  const transferRows = [...expensePreview, ...incomePreview].filter((r) => !!isTransfer[r.rowId]);
  const displayedPreview = isPreviewKindStep
    ? currentPreview.filter((r) => !isTransfer[r.rowId])
    : step === "preview_transfer"
      ? transferRows
      : [];
  // The shared column only appears on the expense step, when at least one row
  // got a suggestion from a matching rule.
  const showShareColumn =
    spaceKind === "personal" &&
    step === "preview_expense" &&
    expensePreview.some((r) => !!r.suggested_share);
  const checkedInView = displayedPreview.filter((r) => !!checked[r.rowId]);
  const otherAccounts = accounts.filter((a) => a.id !== selectedAccountId);
  // Every row is either an expense/income or (once marked) a transfer, so
  // this total matches exactly what handleConfirm submits — no need to sum
  // three separately-filtered per-type counts that are never shown on their own.
  const totalSelectedCount = [...expensePreview, ...incomePreview].filter((r) => checked[r.rowId]).length;

  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={t("transactions.importModal.titleAll")}
      className="md:max-w-3xl"
      closeLabel={t("common.actions.close")}
    >
      {/* Steps indicator */}
      <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-border text-xs text-muted-foreground dark:border-zinc-700 dark:text-muted-foreground">
        <span className={step === "upload" ? "font-semibold text-foreground" : ""}>{t("transactions.importModal.stepFile")}</span>
        <span>→</span>
        <span className={step === "preview_expense" ? "font-semibold text-foreground" : ""}>{t("transactions.importModal.stepExpenses")}</span>
        <span>→</span>
        <span className={step === "preview_income" ? "font-semibold text-foreground" : ""}>{t("transactions.importModal.stepIncomes")}</span>
        <span>→</span>
        <span className={step === "preview_transfer" ? "font-semibold text-foreground" : ""}>{t("transactions.importModal.stepTransfers")}</span>
        <span>→</span>
        <span className={step === "done" ? "font-semibold text-foreground" : ""}>{t("transactions.importModal.stepConfirmAll")}</span>
      </div>

      <div className="pt-4">
      {step === "upload" && (
        <div className="space-y-4 max-w-md">
          <p className="text-sm text-muted-foreground">
            {t("transactions.importModal.formatsSupported")} <strong>N26</strong> (.csv) {t("transactions.importModal.and")}{" "}
            <strong>BNP</strong> (.xls, .xlsx).
          </p>

          {defaultAccountId ? (
            <p className="text-sm text-muted-foreground">
              {t("transactions.importModal.accountLabel")}{" "}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {accounts.find((a) => a.id === defaultAccountId)?.name ?? "…"}
              </span>
            </p>
          ) : (
            <label className="block text-sm font-medium">
              {t("transactions.importModal.destinationAccount")}
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              >
                <option value="">{t("transactions.importModal.selectPlaceholder")}</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-sm font-medium">
            {t("transactions.importModal.file")}
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xls,.xlsx"
              className="mt-1 block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:border-zinc-300 file:px-3 file:py-1.5 file:text-sm dark:text-zinc-400 dark:file:border-zinc-600 dark:file:text-zinc-300 dark:file:bg-zinc-800"
            />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            onClick={() => void handleUpload()}
            disabled={isLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          >
            {isLoading ? t("transactions.importModal.analyzing") : t("transactions.importModal.analyzeButton")}
          </button>
        </div>
      )}

      {isPreviewKindStep && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {step === "preview_expense" ? t("transactions.importModal.stepExpensesLabel") : t("transactions.importModal.stepIncomesLabel")}
          </p>
          {displayedPreview.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("transactions.importModal.noTransactionsOfKindPreview", {
                kind: t(step === "preview_expense" ? "transactions.importModal.kindExpenseWord" : "transactions.importModal.kindIncomeWord"),
              })}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("transactions.importModal.transactionsFound", {
                    count: displayedPreview.length,
                    plural: displayedPreview.length > 1 ? "s" : "",
                    dupCount: displayedPreview.filter((r) => r.is_duplicate).length,
                    dupPlural: displayedPreview.filter((r) => r.is_duplicate).length > 1 ? "s" : "",
                  })}
                </p>
                <div className="flex gap-1 text-xs">
                  <button
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      displayedPreview.filter((r) => !r.is_duplicate).forEach((r) => (all[r.rowId] = true));
                      setChecked((prev) => ({ ...prev, ...all }));
                    }}
                    className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {t("transactions.importModal.selectAll")}
                  </button>
                  <button
                    onClick={() => {
                      const none: Record<string, boolean> = {};
                      displayedPreview.forEach((r) => (none[r.rowId] = false));
                      setChecked((prev) => ({ ...prev, ...none }));
                    }}
                    className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {t("transactions.importModal.selectNone")}
                  </button>
                </div>
              </div>

              {/* Bulk category assignment */}
              {checkedInView.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted px-3 py-2 text-xs">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {t("transactions.importModal.rowsSelected", {
                      count: checkedInView.length,
                      plural: checkedInView.length > 1 ? "s" : "",
                    })}
                  </span>
                  <span className="text-zinc-300 dark:text-muted-foreground">|</span>
                  <span className="text-muted-foreground">{t("transactions.importModal.categoryLabel")} :</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const val = e.target.value;
                      setCategoryMap((prev) => {
                        const next = { ...prev };
                        checkedInView.forEach((r) => { next[r.rowId] = val; });
                        return next;
                      });
                      e.target.value = "";
                    }}
                    className="rounded border border-zinc-300 px-2 py-0.5 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                  >
                    <option value="">{t("transactions.importModal.chooseOption")}</option>
                    {currentCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon ? `${c.icon} ` : ""}{resolveCategoryName(c, t)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted text-left text-muted-foreground">
                      <th className="px-3 py-2">
                        <Check className="h-3.5 w-3.5" />
                      </th>
                      <th className="px-3 py-2">{t("transactions.importModal.colDate")}</th>
                      <th className="px-3 py-2">{t("transactions.importModal.colDescription")}</th>
                      <th className="px-3 py-2 text-right">{t("transactions.importModal.colAmount")}</th>
                      <th className="px-3 py-2">{t("transactions.importModal.colTransfer")}</th>
                      <th className="px-3 py-2 min-w-32">{t("transactions.importModal.categoryLabel")}</th>
                      {showShareColumn && <th className="px-3 py-2">{t("transactions.importModal.colShared")}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPreview.map((row, idx) => (
                      <tr
                        key={`${row.hash}_${idx}`}
                        className={`border-b border-border ${
                          row.is_duplicate && !checked[row.rowId]
                            ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-muted-foreground"
                            : row.is_duplicate && checked[row.rowId]
                              ? "bg-amber-50 dark:bg-amber-900/10"
                              : !categoryMap[row.rowId]
                                ? "bg-orange-50 dark:bg-zinc-800/60"
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={!!checked[row.rowId]}
                            onChange={(e) => setChecked((prev) => ({ ...prev, [row.rowId]: e.target.checked }))}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="px-3 py-2 max-w-[40vw] truncate md:max-w-[200px] cursor-help" title={row.description}>
                          {row.description}
                          {row.is_duplicate && (
                            <span className="ml-1 rounded bg-zinc-200 px-1 py-0.5 text-muted-foreground dark:bg-zinc-700 dark:text-muted-foreground">{t("transactions.importModal.duplicateBadge")}</span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium whitespace-nowrap ${
                            row.amount_cents < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                          } ${row.is_duplicate && !checked[row.rowId] ? "opacity-40" : ""}`}
                        >
                          {formatAmount(row.amount_cents)}
                        </td>
                        <td className="px-3 py-2">
                          {(!row.is_duplicate || checked[row.rowId]) && (
                            <button
                              onClick={() => setIsTransfer((prev) => ({ ...prev, [row.rowId]: true }))}
                              className="rounded px-2 py-0.5 text-xs font-medium bg-zinc-100 text-muted-foreground hover:bg-blue-100 hover:text-blue-700 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-blue-900/40 dark:hover:text-blue-300"
                            >
                              {t("transactions.importModal.transferNo")}
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {(!row.is_duplicate || checked[row.rowId]) && (
                            <select
                              value={categoryMap[row.rowId] ?? ""}
                              onChange={(e) =>
                                setCategoryMap((prev) => ({ ...prev, [row.rowId]: e.target.value }))
                              }
                              className={`w-full rounded border px-2 py-1 text-xs ${
                                !categoryMap[row.rowId]
                                  ? "border-orange-300 bg-orange-50 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-100"
                                  : "border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                              }`}
                            >
                              <option value="">{t("transactions.importModal.noCategoryOption")}</option>
                              {currentCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.icon ? `${c.icon} ` : ""}
                                  {resolveCategoryName(c, t)}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        {showShareColumn && (
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.suggested_share && !row.is_duplicate ? (
                              <label className="flex items-center gap-1.5">
                                <input
                                  type="checkbox"
                                  checked={!!shareMap[row.rowId]}
                                  onChange={(e) =>
                                    setShareMap((prev) => ({
                                      ...prev,
                                      [row.rowId]: e.target.checked ? row.suggested_share! : null,
                                    }))
                                  }
                                />
                                <span className={shareMap[row.rowId] ? "text-foreground" : "text-muted-foreground"}>
                                  {t("transactions.importModal.sharedTarget", {
                                    space: row.suggested_share.space_name,
                                    percent: row.suggested_share.payer_share_percent,
                                  })}
                                </span>
                              </label>
                            ) : null}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      )}

      {step === "preview_transfer" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("transactions.importModal.stepTransfersLabel")}</p>
          {displayedPreview.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("transactions.importModal.noTransferRowsPreview")}</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {t("transactions.importModal.rowsSelected", {
                    count: displayedPreview.length,
                    plural: displayedPreview.length > 1 ? "s" : "",
                  })}
                </p>
              </div>

              {checkedInView.length > 0 && otherAccounts.length > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-800 dark:bg-blue-900/20">
                  <span className="font-medium text-zinc-700 dark:text-zinc-200">
                    {t("transactions.importModal.rowsSelected", {
                      count: checkedInView.length,
                      plural: checkedInView.length > 1 ? "s" : "",
                    })}
                  </span>
                  <span className="text-muted-foreground">{t("transactions.importModal.counterpartyLabel")} :</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const val = e.target.value;
                      setTransferAccountMap((prev) => {
                        const next = { ...prev };
                        checkedInView.forEach((r) => { next[r.rowId] = val; });
                        return next;
                      });
                      e.target.value = "";
                    }}
                    className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 dark:border-blue-700 dark:bg-blue-900/30 dark:text-zinc-100"
                  >
                    <option value="">{t("transactions.importModal.chooseOption")}</option>
                    {otherAccounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted text-left text-muted-foreground">
                      <th className="px-3 py-2">
                        <Check className="h-3.5 w-3.5" />
                      </th>
                      <th className="px-3 py-2">{t("transactions.importModal.colDate")}</th>
                      <th className="px-3 py-2">{t("transactions.importModal.colDescription")}</th>
                      <th className="px-3 py-2 text-right">{t("transactions.importModal.colAmount")}</th>
                      <th className="px-3 py-2 min-w-32">{t("transactions.importModal.counterpartyLabel")}</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {displayedPreview.map((row, idx) => (
                      <tr key={`${row.hash}_${idx}`} className="border-b border-zinc-100 bg-blue-50/50 dark:border-zinc-800 dark:bg-blue-900/10">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={!!checked[row.rowId]}
                            onChange={(e) => setChecked((prev) => ({ ...prev, [row.rowId]: e.target.checked }))}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="px-3 py-2 max-w-[40vw] truncate md:max-w-[200px] cursor-help" title={row.description}>{row.description}</td>
                        <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${row.amount_cents < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                          {formatAmount(row.amount_cents)}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={transferAccountMap[row.rowId] ?? ""}
                            onChange={(e) => setTransferAccountMap((prev) => ({ ...prev, [row.rowId]: e.target.value }))}
                            className="w-full rounded border px-2 py-1 text-xs border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20 dark:text-zinc-100"
                          >
                            <option value="">{t("transactions.importModal.unknownAccountOption")}</option>
                            {otherAccounts.map((a) => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => setIsTransfer((prev) => ({ ...prev, [row.rowId]: false }))}
                            className="whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium bg-zinc-100 text-muted-foreground hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
                          >
                            {t("transactions.importModal.unmarkTransfer")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      )}

      {step === "done" && (
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
          <p className="text-lg font-semibold">{t("transactions.importModal.doneTitle")}</p>
          <p className="text-sm text-muted-foreground">
            {sharedCount === null
              ? t("transactions.importModal.doneDescription", {
                  count: importedCount,
                  plural: importedCount > 1 ? "s" : "",
                })
              : t("transactions.importModal.doneDescriptionShared", {
                  count: importedCount,
                  plural: importedCount > 1 ? "s" : "",
                  shared: sharedCount,
                })}
          </p>
        </div>
      )}
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-border pt-4">
        {step === "upload" && (
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm text-foreground">
            {t("common.actions.cancel")}
          </button>
        )}
        {step === "preview_expense" && (
          <>
            <button
              onClick={() => setStep("upload")}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground"
            >
              {t("transactions.importModal.back")}
            </button>
            <button
              onClick={() => setStep("preview_income")}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              {t("transactions.importModal.next")}
            </button>
          </>
        )}
        {step === "preview_income" && (
          <>
            <button
              onClick={() => setStep("preview_expense")}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground"
            >
              {t("transactions.importModal.back")}
            </button>
            <button
              onClick={() => setStep("preview_transfer")}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
            >
              {t("transactions.importModal.next")}
            </button>
          </>
        )}
        {step === "preview_transfer" && (
          <>
            <button
              onClick={() => setStep("preview_income")}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground"
            >
              {t("transactions.importModal.back")}
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={isLoading || totalSelectedCount === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
            >
              {isLoading
                ? t("transactions.importModal.importing")
                : t("transactions.importModal.importButton", {
                    count: totalSelectedCount,
                    plural: totalSelectedCount > 1 ? "s" : "",
                  })}
            </button>
          </>
        )}
        {step === "done" && (
          <button
            onClick={onSuccess}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >
            {t("common.actions.close")}
          </button>
        )}
      </div>
    </Modal>
  );
}
