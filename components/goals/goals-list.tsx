"use client";

import { useCallback, useEffect, useState } from "react";

import { AddFundsModal } from "@/components/goals/add-funds-modal";
import { GoalsModal } from "@/components/goals/goals-modal";

type Goal = {
  id: string;
  name: string;
  target_amount_cents: number;
  current_amount_cents: number;
  deadline: string | null;
  color: string | null;
  icon: string | null;
  linked_category_id: string | null;
};

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

function progressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

function formatDeadline(date: string): string {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function GoalsList() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null);

  const loadGoals = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch("/api/savings-goals");
    if (res.ok) {
      const data = (await res.json()) as { goals: Goal[] };
      setGoals(data.goals ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void loadGoals();
  }, [loadGoals]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'objectif « ${name} » ?`)) return;
    const res = await fetch(`/api/savings-goals/${id}`, { method: "DELETE" });
    if (res.ok) await loadGoals();
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-zinc-500">Chargement…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{goals.length} objectif{goals.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nouvel objectif
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-600">
          Aucun objectif d&apos;épargne. Créez-en un pour commencer.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const pct = progressPercent(goal.current_amount_cents, goal.target_amount_cents);
            const isComplete = pct >= 100;
            return (
              <div
                key={goal.id}
                className="flex flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {goal.icon && <span className="text-xl">{goal.icon}</span>}
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{goal.name}</h3>
                      {goal.deadline && (
                        <p className="text-xs text-zinc-500">Échéance : {formatDeadline(goal.deadline)}</p>
                      )}
                    </div>
                  </div>
                  {goal.linked_category_id && (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                      Auto
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: goal.color ?? "#3b82f6",
                    }}
                  />
                </div>

                {/* Amounts */}
                <div className="mb-4 flex items-baseline justify-between text-sm">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {formatEuros(goal.current_amount_cents)}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {pct}% · {formatEuros(goal.target_amount_cents)}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-auto flex gap-2">
                  {!goal.linked_category_id && !isComplete && (
                    <button
                      onClick={() => setAddFundsGoal(goal)}
                      className="flex-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
                    >
                      + Ajouter des fonds
                    </button>
                  )}
                  {isComplete && (
                    <span className="flex-1 rounded-md bg-emerald-50 px-3 py-1.5 text-center text-xs font-medium text-emerald-700">
                      ✓ Objectif atteint
                    </span>
                  )}
                  <button
                    onClick={() => setEditingGoal(goal)}
                    className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    Modifier
                  </button>
                  <button
                    onClick={() => void handleDelete(goal.id, goal.name)}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800/50 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <GoalsModal
          onSuccess={async () => {
            setShowCreate(false);
            await loadGoals();
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingGoal && (
        <GoalsModal
          goalId={editingGoal.id}
          defaultValues={editingGoal}
          onSuccess={async () => {
            setEditingGoal(null);
            await loadGoals();
          }}
          onClose={() => setEditingGoal(null)}
        />
      )}

      {addFundsGoal && (
        <AddFundsModal
          goalId={addFundsGoal.id}
          goalName={addFundsGoal.name}
          onSuccess={async () => {
            setAddFundsGoal(null);
            await loadGoals();
          }}
          onClose={() => setAddFundsGoal(null)}
        />
      )}
    </div>
  );
}
