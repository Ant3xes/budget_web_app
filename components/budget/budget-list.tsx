"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { BudgetModal } from "@/components/budget/budget-modal";
import { BudgetBar } from "@/components/dashboard/budget-bar";
import { CategoryBadge } from "@/components/category-badge";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { formatEuros } from "@/lib/format";

type BudgetCategory = { name: string; color: string | null; icon: string | null };

type Budget = {
  id: string;
  category_id: string;
  month: string;
  amount_cents: number;
  currency: string;
  categories: BudgetCategory | null;
};

interface BudgetListProps {
  initialMonth: string; // YYYY-MM
}

function prevMonth(yyyyMM: string): string {
  const [year, mon] = yyyyMM.split("-").map(Number) as [number, number];
  if (mon === 1) return `${year - 1}-12`;
  return `${year}-${String(mon - 1).padStart(2, "0")}`;
}

function monthLabel(yyyyMM: string): string {
  const [year, mon] = yyyyMM.split("-");
  return new Date(`${year}-${mon}-01`).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function BudgetList({ initialMonth }: BudgetListProps) {
  const [month, setMonth] = useState(initialMonth);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [consumption, setConsumption] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [deletingBudget, setDeletingBudget] = useState<Budget | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const loadData = useCallback(async (m: string) => {
    setIsLoading(true);
    const res = await fetch(`/api/budgets?month=${m}`);
    if (res.ok) {
      const data = (await res.json()) as { budgets: Budget[]; consumption: Record<string, number> };
      setBudgets(data.budgets ?? []);
      setConsumption(data.consumption ?? {});
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on month change
    void loadData(month);
  }, [month, loadData]);

  // Keep URL in sync with month navigation
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("month", month);
    window.history.replaceState({}, "", url.toString());
  }, [month]);

  const handleCopyFromPrev = async () => {
    setIsCopying(true);
    setCopyError(null);
    const prev = prevMonth(month);
    const prevRes = await fetch(`/api/budgets?month=${prev}`);
    if (!prevRes.ok) {
      setCopyError("Impossible de récupérer le mois précédent");
      setIsCopying(false);
      return;
    }
    const prevData = (await prevRes.json()) as { budgets: Budget[] };
    const prevBudgets = prevData.budgets ?? [];

    if (prevBudgets.length === 0) {
      setCopyError(`Aucune enveloppe trouvée pour ${monthLabel(prev)}`);
      setIsCopying(false);
      return;
    }

    await Promise.all(
      prevBudgets.map((b) =>
        fetch("/api/budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ category_id: b.category_id, month, amount_cents: b.amount_cents }),
        }),
      ),
    );

    await loadData(month);
    setIsCopying(false);
  };

  const handleDelete = async () => {
    if (!deletingBudget) return;
    setIsDeleting(true);
    const res = await fetch(`/api/budgets/${deletingBudget.id}`, { method: "DELETE" });
    setIsDeleting(false);
    if (res.ok) {
      setDeletingBudget(null);
      await loadData(month);
    }
  };

  const goToPrevMonth = () => setMonth(prevMonth(month));
  const goToNextMonth = () => {
    const [year, mon] = month.split("-").map(Number) as [number, number];
    const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, "0")}`;
    setMonth(next);
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount_cents, 0);
  const totalConsumed = budgets.reduce((s, b) => s + (consumption[b.category_id] ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={goToPrevMonth}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            ←
          </button>
          <h2 className="text-lg font-semibold capitalize">{monthLabel(month)}</h2>
          <button
            onClick={goToNextMonth}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            →
          </button>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Ajouter une enveloppe
        </button>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-zinc-500">Chargement…</p>
      ) : budgets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-600">
          <p className="text-zinc-500 dark:text-zinc-400">Aucune enveloppe pour {monthLabel(month)}.</p>
          <div className="mt-4">
            {copyError && <p className="mb-2 text-sm text-red-500">{copyError}</p>}
            <p className="mb-3 text-sm text-zinc-500">
              Recopier les enveloppes de {monthLabel(prevMonth(month))} ?
            </p>
            <button
              onClick={handleCopyFromPrev}
              disabled={isCopying}
              className="rounded-md bg-zinc-700 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isCopying ? "Copie en cours…" : `Recopier depuis ${monthLabel(prevMonth(month))}`}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Budget total</p>
              <p className="mt-1 text-lg font-semibold">{formatEuros(totalBudget)}</p>
            </article>
            <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Consommé</p>
              <p className="mt-1 text-lg font-semibold">{formatEuros(totalConsumed)}</p>
            </article>
            <article className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Restant</p>
              <p
                className={`mt-1 text-lg font-semibold ${totalBudget - totalConsumed < 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
              >
                {formatEuros(totalBudget - totalConsumed)}
              </p>
            </article>
          </div>

          {/* Budget table */}
          <div className="overflow-x-auto rounded-lg bg-white shadow-sm dark:bg-zinc-900">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-left text-xs font-medium text-zinc-500 uppercase dark:border-zinc-700 dark:text-zinc-400">
                  <th className="px-4 py-3">Catégorie</th>
                  <th className="px-4 py-3 text-right">Enveloppe</th>
                  <th className="px-4 py-3 text-right">Consommé</th>
                  <th className="px-4 py-3 text-right">Reste</th>
                  <th className="px-4 py-3 w-40">Progression</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...budgets]
                  .sort((a, b) => {
                    const ratioA = a.amount_cents > 0 ? (consumption[a.category_id] ?? 0) / a.amount_cents : 0;
                    const ratioB = b.amount_cents > 0 ? (consumption[b.category_id] ?? 0) / b.amount_cents : 0;
                    return ratioB - ratioA;
                  })
                  .map((budget) => {
                    const consumed = consumption[budget.category_id] ?? 0;
                    const remaining = budget.amount_cents - consumed;
                    const ratio = budget.amount_cents > 0 ? consumed / budget.amount_cents : 0;

                    return (
                      <tr key={budget.id} className="group border-b border-zinc-50 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <CategoryBadge
                              name={budget.categories?.name ?? "—"}
                              icon={budget.categories?.icon}
                              color={budget.categories?.color}
                            />
                            {ratio > 1 && (
                              <span className="inline-block shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/20 dark:text-red-400">
                                Dépassé
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatEuros(budget.amount_cents)}
                        </td>
                        <td className="px-4 py-3 text-right">{formatEuros(consumed)}</td>
                        <td className={`px-4 py-3 text-right font-medium ${remaining < 0 ? "text-red-600 dark:text-red-400" : "text-zinc-700 dark:text-zinc-300"}`}>
                          {formatEuros(remaining)}
                        </td>
                        <td className="px-4 py-3">
                          <BudgetBar ratio={ratio} />
                          <p className="mt-0.5 text-right text-xs text-zinc-400">
                            {Math.round(ratio * 100)}%
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setEditingBudget(budget)}
                              aria-label="Modifier l'enveloppe"
                              title="Modifier"
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon-sm"
                              onClick={() => setDeletingBudget(budget)}
                              aria-label="Supprimer l'enveloppe"
                              title="Supprimer"
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
          </div>
        </>
      )}

      {showCreate && (
        <BudgetModal
          month={month}
          onSuccess={async () => {
            setShowCreate(false);
            await loadData(month);
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingBudget && (
        <BudgetModal
          month={month}
          budgetId={editingBudget.id}
          defaultValues={{
            category_id: editingBudget.category_id,
            amount_cents: editingBudget.amount_cents,
          }}
          onSuccess={async () => {
            setEditingBudget(null);
            await loadData(month);
          }}
          onClose={() => setEditingBudget(null)}
        />
      )}

      <AlertDialog
        open={deletingBudget !== null}
        onOpenChange={(open) => !open && setDeletingBudget(null)}
        title="Supprimer cette enveloppe ?"
        description={
          deletingBudget
            ? `L'enveloppe "${deletingBudget.categories?.name ?? "—"}" sera supprimée pour ${monthLabel(month)}.`
            : undefined
        }
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />
    </div>
  );
}
