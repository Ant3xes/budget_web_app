"use client";

import { useEffect, useRef, useState } from "react";

type PreviewRowRaw = {
  hash: string;
  date: string;
  description: string;
  amount_cents: number;
  kind: "expense" | "income";
  suggested_category_id: string | null;
  is_transfer_candidate: boolean;
  is_duplicate: boolean;
};

type PreviewRow = PreviewRowRaw & { rowId: string };

type Category = { id: string; name: string; kind: string; icon: string | null };
type Account = { id: string; name: string };

interface ImportModalProps {
  kind?: "expense" | "income";
  defaultAccountId?: string;
  onSuccess: () => void;
  onClose: () => void;
}

type Step = "upload" | "preview_expense" | "preview_income" | "done";

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

export function ImportModal({ kind, defaultAccountId, onSuccess, onClose }: ImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState(defaultAccountId ?? "");
  const [expensePreview, setExpensePreview] = useState<PreviewRow[]>([]);
  const [incomePreview, setIncomePreview] = useState<PreviewRow[]>([]);
  const [isTransfer, setIsTransfer] = useState<Record<string, boolean>>({}); // hash -> treat as transfer
  const [transferAccountMap, setTransferAccountMap] = useState<Record<string, string>>({}); // hash -> counterpart account_id
  const [transferFilter, setTransferFilter] = useState<"all" | "transfer" | "non_transfer">("all");
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({}); // hash -> category_id
  const [checked, setChecked] = useState<Record<string, boolean>>({}); // hash -> selected
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
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
      setError("Veuillez sélectionner un fichier");
      return;
    }
    if (!selectedAccountId) {
      setError("Veuillez sélectionner un compte");
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
      setError(data.error ?? "Erreur lors du parsing");
      return;
    }

    const data = (await res.json()) as { preview: PreviewRowRaw[] };
    const initCats: Record<string, string> = {};
    const initChecked: Record<string, boolean> = {};
    const initTransfer: Record<string, boolean> = {};

    if (kind) {
      // Single-kind mode (backward compatible)
      const rows = data.preview
        .filter((r) => r.kind === kind)
        .map((r, i): PreviewRow => ({ ...r, rowId: `${kind}_${i}` }));
      if (rows.length === 0) {
        setError(`Aucune transaction de type "${kind === "expense" ? "dépense" : "revenu"}" trouvée dans ce fichier.`);
        return;
      }
      if (kind === "expense") setExpensePreview(rows);
      else setIncomePreview(rows);
      for (const row of rows) {
        initCats[row.rowId] = row.suggested_category_id ?? "";
        initChecked[row.rowId] = !row.is_duplicate;
        initTransfer[row.rowId] = row.is_transfer_candidate;
      }
    } else {
      // Two-step mode (all kinds)
      if (data.preview.length === 0) {
        setError("Aucune transaction trouvée dans ce fichier.");
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
      for (const row of [...expenses, ...incomes]) {
        initCats[row.rowId] = row.suggested_category_id ?? "";
        initChecked[row.rowId] = !row.is_duplicate;
        initTransfer[row.rowId] = row.is_transfer_candidate;
      }
    }
    setCategoryMap(initCats);
    setChecked(initChecked);
    setIsTransfer(initTransfer);
    setTransferAccountMap({});
    setTransferFilter("all");
    setStep(kind === "income" ? "preview_income" : "preview_expense");
  };

  const handleConfirm = async () => {
    const allRows = [...expensePreview, ...incomePreview];
    const selected = allRows.filter((r) => checked[r.rowId]);
    if (selected.length === 0) {
      setError("Aucune transaction sélectionnée");
      return;
    }

    setError(null);
    setIsLoading(true);

    const transactions = selected.map((r) => ({
      hash: r.hash,
      date: r.date,
      description: r.description,
      amount_cents: r.amount_cents,
      kind: isTransfer[r.rowId] ? "transfer" as const : r.kind,
      category_id: isTransfer[r.rowId] ? null : (categoryMap[r.rowId] || null),
      transfer_account_id: isTransfer[r.rowId] ? (transferAccountMap[r.rowId] || null) : undefined,
    }));

    const res = await fetch("/api/import/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: selectedAccountId, transactions }),
    });

    setIsLoading(false);

    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Erreur lors de l'import");
      return;
    }

    const data = (await res.json()) as { imported: number };
    setImportedCount(data.imported);
    setStep("done");
  };

  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const incomeCategories = categories.filter((c) => c.kind === "income");
  const currentPreview = step === "preview_expense" ? expensePreview : incomePreview;
  const currentCategories = step === "preview_expense" ? expenseCategories : incomeCategories;
  const displayedPreview = currentPreview.filter((r) => {
    if (transferFilter === "transfer") return !!isTransfer[r.rowId];
    if (transferFilter === "non_transfer") return !isTransfer[r.rowId];
    return true;
  });
  const checkedInView = displayedPreview.filter((r) => !!checked[r.rowId]);
  const expenseSelectedCount = expensePreview.filter((r) => checked[r.rowId]).length;
  const incomeSelectedCount = incomePreview.filter((r) => checked[r.rowId]).length;
  const totalSelectedCount = expenseSelectedCount + incomeSelectedCount;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh] dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold">
            {kind ? `Importer des ${kind === "expense" ? "dépenses" : "revenus"}` : "Importer des transactions"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none dark:text-zinc-500 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-4 px-6 py-3 border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <span className={step === "upload" ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>1. Fichier</span>
          <span>→</span>
          {kind ? (
            <>
              <span className={step === "preview_expense" || step === "preview_income" ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>2. Prévisualisation</span>
              <span>→</span>
              <span className={step === "done" ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>3. Confirmation</span>
            </>
          ) : (
            <>
              <span className={step === "preview_expense" ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>2. Dépenses</span>
              <span>→</span>
              <span className={step === "preview_income" ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>3. Revenus</span>
              <span>→</span>
              <span className={step === "done" ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>4. Confirmation</span>
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === "upload" && (
            <div className="space-y-4 max-w-md">
              <p className="text-sm text-zinc-600">
                Formats supportés : <strong>N26</strong> (.csv) et <strong>BNP</strong> (.xls, .xlsx).
              </p>

              {defaultAccountId ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Compte :{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {accounts.find((a) => a.id === defaultAccountId)?.name ?? "…"}
                  </span>
                </p>
              ) : (
                <label className="block text-sm font-medium">
                  Compte de destination
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:bg-zinc-800 dark:border-zinc-600 dark:text-zinc-100"
                  >
                    <option value="">— Sélectionner —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block text-sm font-medium">
                Fichier
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  className="mt-1 block w-full text-sm text-zinc-600 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:px-3 file:py-1.5 file:text-sm dark:text-zinc-400 dark:file:border-zinc-600 dark:file:text-zinc-300 dark:file:bg-zinc-800"
                />
              </label>

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                onClick={() => void handleUpload()}
                disabled={isLoading}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {isLoading ? "Analyse en cours…" : "Analyser le fichier"}
              </button>
            </div>
          )}

          {(step === "preview_expense" || step === "preview_income") && (
            <div className="space-y-3">
              {!kind && (
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {step === "preview_expense" ? "Étape 2 — Dépenses" : "Étape 3 — Revenus"}
                </p>
              )}
              {currentPreview.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  Aucune transaction de type &laquo;&nbsp;{step === "preview_expense" ? "dépense" : "revenu"}&nbsp;&raquo; dans ce fichier.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-zinc-600">
                      {currentPreview.length} transaction{currentPreview.length > 1 ? "s" : ""} trouvée{currentPreview.length > 1 ? "s" : ""} —{" "}
                      {currentPreview.filter((r) => r.is_duplicate).length} doublon{currentPreview.filter((r) => r.is_duplicate).length > 1 ? "s" : ""} détecté{currentPreview.filter((r) => r.is_duplicate).length > 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Filter buttons */}
                      <div className="flex rounded border border-zinc-200 text-xs dark:border-zinc-700 overflow-hidden">
                        {(["all", "transfer", "non_transfer"] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setTransferFilter(f)}
                            className={`px-2 py-1 transition-colors ${
                              transferFilter === f
                                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                                : "hover:bg-zinc-50 text-zinc-500 dark:text-zinc-400 dark:hover:bg-zinc-800"
                            }`}
                          >
                            {f === "all" ? "Tous" : f === "transfer" ? "Virements" : "Autres"}
                          </button>
                        ))}
                      </div>
                      {/* Select all / none on displayed rows */}
                      <div className="flex gap-1 text-xs">
                        <button
                          onClick={() => {
                            const all: Record<string, boolean> = {};
                            displayedPreview.filter((r) => !r.is_duplicate).forEach((r) => (all[r.rowId] = true));
                            setChecked((prev) => ({ ...prev, ...all }));
                          }}
                          className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Tout sélectionner
                        </button>
                        <button
                          onClick={() => {
                            const none: Record<string, boolean> = {};
                            displayedPreview.forEach((r) => (none[r.rowId] = false));
                            setChecked((prev) => ({ ...prev, ...none }));
                          }}
                          className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Tout désélectionner
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Bulk action bar */}
                  {checkedInView.length > 0 && (() => {
                    const nonTransferChecked = checkedInView.filter((r) => !isTransfer[r.rowId]);
                    const transferChecked = checkedInView.filter((r) => !!isTransfer[r.rowId]);
                    const otherAccounts = accounts.filter((a) => a.id !== selectedAccountId);
                    return (
                      <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-800">
                        <span className="font-medium text-zinc-700 dark:text-zinc-200">
                          {checkedInView.length} ligne{checkedInView.length > 1 ? "s" : ""} sélectionnée{checkedInView.length > 1 ? "s" : ""}
                        </span>
                        {nonTransferChecked.length > 0 && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-600">|</span>
                            <span className="text-zinc-500 dark:text-zinc-400">
                              Catégorie <span className="text-zinc-400">({nonTransferChecked.length})</span> :
                            </span>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                const val = e.target.value;
                                setCategoryMap((prev) => {
                                  const next = { ...prev };
                                  nonTransferChecked.forEach((r) => { next[r.rowId] = val; });
                                  return next;
                                });
                                e.target.value = "";
                              }}
                              className="rounded border border-zinc-300 px-2 py-0.5 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
                            >
                              <option value="">— Choisir —</option>
                              {currentCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.icon ? `${c.icon} ` : ""}{c.name}
                                </option>
                              ))}
                            </select>
                          </>
                        )}
                        {transferChecked.length > 0 && otherAccounts.length > 0 && (
                          <>
                            <span className="text-zinc-300 dark:text-zinc-600">|</span>
                            <span className="text-zinc-500 dark:text-zinc-400">
                              Contrepartie <span className="text-zinc-400">({transferChecked.length})</span> :
                            </span>
                            <select
                              defaultValue=""
                              onChange={(e) => {
                                if (!e.target.value) return;
                                const val = e.target.value;
                                setTransferAccountMap((prev) => {
                                  const next = { ...prev };
                                  transferChecked.forEach((r) => { next[r.rowId] = val; });
                                  return next;
                                });
                                e.target.value = "";
                              }}
                              className="rounded border border-blue-300 bg-blue-50 px-2 py-0.5 dark:border-blue-700 dark:bg-blue-900/30 dark:text-zinc-100"
                            >
                              <option value="">— Choisir —</option>
                              {otherAccounts.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </>
                        )}
                      </div>
                    );
                  })()}

                  <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                          <th className="px-3 py-2">✓</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Description</th>
                          <th className="px-3 py-2 text-right">Montant</th>
                          <th className="px-3 py-2">Virement ?</th>
                          <th className="px-3 py-2 min-w-[160px]">Catégorie / Contrepartie</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedPreview.map((row, idx) => {
                          const rowIsTransfer = !!isTransfer[row.rowId];
                          return (
                          <tr
                            key={`${row.hash}_${idx}`}
                            className={`border-b border-zinc-100 dark:border-zinc-800 ${
                              row.is_duplicate && !checked[row.rowId]
                                ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                                : row.is_duplicate && checked[row.rowId]
                                  ? "bg-amber-50 dark:bg-amber-900/10"
                                  : rowIsTransfer
                                  ? "bg-blue-50 dark:bg-blue-900/10"
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
                            <td className="px-3 py-2 max-w-[200px] truncate cursor-help" title={row.description}>
                              {row.description}
                              {row.is_duplicate && (
                                <span className="ml-1 rounded bg-zinc-200 px-1 py-0.5 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">doublon</span>
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
                                  onClick={() => setIsTransfer((prev) => ({ ...prev, [row.rowId]: !rowIsTransfer }))}
                                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                    rowIsTransfer
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
                                      : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-600"
                                  }`}
                                >
                                  {rowIsTransfer ? "Oui" : "Non"}
                                </button>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {(!row.is_duplicate || checked[row.rowId]) && !rowIsTransfer && (
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
                                  <option value="">— Sans catégorie —</option>
                                  {currentCategories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.icon ? `${c.icon} ` : ""}
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              {(!row.is_duplicate || checked[row.rowId]) && rowIsTransfer && (
                                <select
                                  value={transferAccountMap[row.rowId] ?? ""}
                                  onChange={(e) =>
                                    setTransferAccountMap((prev) => ({ ...prev, [row.rowId]: e.target.value }))
                                  }
                                  className="w-full rounded border px-2 py-1 text-xs border-blue-300 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20 dark:text-zinc-100"
                                >
                                  <option value="">— Compte inconnu —</option>
                                  {accounts
                                    .filter((a) => a.id !== selectedAccountId)
                                    .map((a) => (
                                      <option key={a.id} value={a.id}>{a.name}</option>
                                    ))}
                                </select>
                              )}
                            </td>
                          </tr>
                          );
                        })}
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
              <span className="text-4xl">✅</span>
              <p className="text-lg font-semibold">Import terminé</p>
              <p className="text-sm text-zinc-600">
                {importedCount} transaction{importedCount > 1 ? "s" : ""} importée{importedCount > 1 ? "s" : ""} avec succès.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-700">
          {step === "upload" && (
            <button onClick={onClose} className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-300">
              Annuler
            </button>
          )}
          {step === "preview_expense" && (
            <>
              <button
                onClick={() => setStep("upload")}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-300"
              >
                ← Retour
              </button>
              {kind ? (
                <button
                  onClick={() => void handleConfirm()}
                  disabled={isLoading || expenseSelectedCount === 0}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
                >
                  {isLoading
                    ? "Import en cours…"
                    : `Importer ${expenseSelectedCount} transaction${expenseSelectedCount > 1 ? "s" : ""}`}
                </button>
              ) : (
                <button
                  onClick={() => setStep("preview_income")}
                  className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
                >
                  Suivant →
                </button>
              )}
            </>
          )}
          {step === "preview_income" && (
            <>
              <button
                onClick={() => setStep(kind ? "upload" : "preview_expense")}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-300"
              >
                ← Retour
              </button>
              <button
                onClick={() => void handleConfirm()}
                disabled={isLoading || totalSelectedCount === 0}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {isLoading
                  ? "Import en cours…"
                  : `Importer ${totalSelectedCount} transaction${totalSelectedCount > 1 ? "s" : ""}`}
              </button>
            </>
          )}
          {step === "done" && (
            <button
              onClick={onSuccess}
              className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
