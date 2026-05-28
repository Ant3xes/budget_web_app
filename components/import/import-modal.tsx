"use client";

import { useEffect, useRef, useState } from "react";

type PreviewRow = {
  hash: string;
  date: string;
  description: string;
  amount_cents: number;
  kind: "expense" | "income";
  suggested_category_id: string | null;
  is_duplicate: boolean;
};

type Category = { id: string; name: string; kind: string; icon: string | null };
type Account = { id: string; name: string };

interface ImportModalProps {
  kind: "expense" | "income";
  onSuccess: () => void;
  onClose: () => void;
}

type Step = "upload" | "preview" | "done";

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

export function ImportModal({ kind, onSuccess, onClose }: ImportModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
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
        if (d.accounts.length > 0) setSelectedAccountId(d.accounts[0]!.id);
      }
      if (catRes.ok) {
        const d = (await catRes.json()) as { categories: Category[] };
        setCategories(d.categories ?? []);
      }
    };
    void load();
  }, []);

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

    const data = (await res.json()) as { preview: PreviewRow[] };
    const rows = data.preview.filter((r) => r.kind === kind);

    if (rows.length === 0) {
      setError(`Aucune transaction de type "${kind === "expense" ? "dépense" : "revenu"}" trouvée dans ce fichier.`);
      return;
    }

    setPreview(rows);

    // Init category map from suggestions
    const initCats: Record<string, string> = {};
    const initChecked: Record<string, boolean> = {};
    for (const row of rows) {
      initCats[row.hash] = row.suggested_category_id ?? "";
      initChecked[row.hash] = !row.is_duplicate;
    }
    setCategoryMap(initCats);
    setChecked(initChecked);
    setStep("preview");
  };

  const handleConfirm = async () => {
    const selected = preview.filter((r) => checked[r.hash] && !r.is_duplicate);
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
      kind: r.kind,
      category_id: categoryMap[r.hash] || null,
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

  const filteredCategories = categories.filter((c) => c.kind === kind);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl flex flex-col max-h-[90vh] dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="text-lg font-semibold">
            Importer des {kind === "expense" ? "dépenses" : "revenus"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl leading-none dark:text-zinc-500 dark:hover:text-zinc-200">
            ×
          </button>
        </div>

        {/* Steps indicator */}
        <div className="flex gap-4 px-6 py-3 border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          <span className={step === "upload" ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>1. Fichier</span>
          <span>→</span>
          <span className={step === "preview" ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>2. Prévisualisation</span>
          <span>→</span>
          <span className={step === "done" ? "font-semibold text-zinc-900 dark:text-zinc-100" : ""}>3. Confirmation</span>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {step === "upload" && (
            <div className="space-y-4 max-w-md">
              <p className="text-sm text-zinc-600">
                Formats supportés : <strong>N26</strong> (.csv) et <strong>BNP</strong> (.xls, .xlsx).
              </p>

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

          {step === "preview" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-600">
                  {preview.length} transaction{preview.length > 1 ? "s" : ""} trouvée{preview.length > 1 ? "s" : ""} —{" "}
                  {preview.filter((r) => r.is_duplicate).length} doublon{preview.filter((r) => r.is_duplicate).length > 1 ? "s" : ""} détecté{preview.filter((r) => r.is_duplicate).length > 1 ? "s" : ""}
                </p>
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => {
                      const all: Record<string, boolean> = {};
                      preview.filter((r) => !r.is_duplicate).forEach((r) => (all[r.hash] = true));
                      setChecked((prev) => ({ ...prev, ...all }));
                    }}
                    className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Tout sélectionner
                  </button>
                  <button
                    onClick={() => {
                      const none: Record<string, boolean> = {};
                      preview.forEach((r) => (none[r.hash] = false));
                      setChecked(none);
                    }}
                    className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Tout désélectionner
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50 text-left text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                      <th className="px-3 py-2">✓</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2 text-right">Montant</th>
                      <th className="px-3 py-2 min-w-[160px]">Catégorie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row) => (
                      <tr
                        key={row.hash}
                        className={`border-b border-zinc-100 dark:border-zinc-800 ${
                          row.is_duplicate
                            ? "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
                            : !categoryMap[row.hash]
                              ? "bg-orange-50 dark:bg-zinc-800/60"
                              : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={!!checked[row.hash] && !row.is_duplicate}
                            disabled={row.is_duplicate}
                            onChange={(e) => setChecked((prev) => ({ ...prev, [row.hash]: e.target.checked }))}
                          />
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.date)}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">
                          {row.description}
                          {row.is_duplicate && (
                            <span className="ml-1 rounded bg-zinc-200 px-1 py-0.5 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">doublon</span>
                          )}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium whitespace-nowrap ${
                            row.amount_cents < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"
                          } ${row.is_duplicate ? "opacity-40" : ""}`}
                        >
                          {formatAmount(row.amount_cents)}
                        </td>
                        <td className="px-3 py-2">
                          {!row.is_duplicate && (
                            <select
                              value={categoryMap[row.hash] ?? ""}
                              onChange={(e) =>
                                setCategoryMap((prev) => ({ ...prev, [row.hash]: e.target.value }))
                              }
                              className={`w-full rounded border px-2 py-1 text-xs ${
                                !categoryMap[row.hash]
                                  ? "border-orange-300 bg-orange-50 dark:border-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-100"
                                  : "border-zinc-300 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                              }`}
                            >
                              <option value="">— Sans catégorie —</option>
                              {filteredCategories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.icon ? `${c.icon} ` : ""}
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
          {step === "preview" && (
            <>
              <button
                onClick={() => setStep("upload")}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600 dark:text-zinc-300"
              >
                ← Retour
              </button>
              <button
                onClick={() => void handleConfirm()}
                disabled={isLoading || Object.values(checked).every((v) => !v)}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {isLoading
                  ? "Import en cours…"
                  : `Importer ${Object.values(checked).filter(Boolean).length} transaction${Object.values(checked).filter(Boolean).length > 1 ? "s" : ""}`}
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
