"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, PiggyBank } from "lucide-react";

import { AddFundsModal } from "@/components/goals/add-funds-modal";
import { GoalsModal } from "@/components/goals/goals-modal";
import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatEuros } from "@/lib/format";

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
  const { t } = useLocale();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!deletingGoal) return;
    setIsDeleting(true);
    const res = await fetch(`/api/savings-goals/${deletingGoal.id}`, { method: "DELETE" });
    setIsDeleting(false);
    if (res.ok) {
      setDeletingGoal(null);
      await loadGoals();
    }
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{t("common.state.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t(goals.length === 1 ? "goals.countSingular" : "goals.countPlural", { count: goals.length })}
        </p>
        <Button onClick={() => setShowCreate(true)}>{t("goals.newGoal")}</Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState icon={PiggyBank} title={t("goals.empty")} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => {
            const pct = progressPercent(goal.current_amount_cents, goal.target_amount_cents);
            const isComplete = pct >= 100;
            return (
              <Card key={goal.id} interactive className="flex flex-col p-5">
                {/* Header */}
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {goal.icon && <span className="text-xl">{goal.icon}</span>}
                    <div>
                      <h3 className="text-sm font-semibold">{goal.name}</h3>
                      {goal.deadline && (
                        <p className="text-xs text-muted-foreground">
                          {t("goals.deadlineLabel", { date: formatDeadline(goal.deadline) })}
                        </p>
                      )}
                    </div>
                  </div>
                  {goal.linked_category_id && (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                      {t("goals.auto")}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mb-2 h-2.5 w-full overflow-hidden rounded-full bg-muted">
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
                  <span className="font-medium">{formatEuros(goal.current_amount_cents)}</span>
                  <span className="text-muted-foreground">
                    {pct}% · {formatEuros(goal.target_amount_cents)}
                  </span>
                </div>

                {/* Actions */}
                <div className="mt-auto flex gap-2">
                  {!goal.linked_category_id && !isComplete && (
                    <Button size="sm" className="flex-1" onClick={() => setAddFundsGoal(goal)}>
                      {t("goals.addFunds")}
                    </Button>
                  )}
                  {isComplete && (
                    <span className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-center text-xs font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" /> {t("goals.goalReached")}
                    </span>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setEditingGoal(goal)}>
                    {t("common.actions.edit")}
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setDeletingGoal(goal)}>
                    {t("common.actions.delete")}
                  </Button>
                </div>
              </Card>
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

      <AlertDialog
        open={deletingGoal !== null}
        onOpenChange={(open) => !open && setDeletingGoal(null)}
        title={t("goals.deleteConfirm", { name: deletingGoal?.name ?? "" })}
        onConfirm={() => void handleDelete()}
        isConfirming={isDeleting}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
      />
    </div>
  );
}
