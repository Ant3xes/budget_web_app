"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useCallback, useEffect, useState } from "react";
import { GripVertical, Pencil, Trash2 } from "lucide-react";

import { ImportRulesModal } from "@/components/settings/import-rules-modal";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";

type ImportRule = {
  id: string;
  keyword: string;
  category_id: string;
  kind: "expense" | "income";
  priority: number;
  categories: { name: string; icon: string | null } | null;
};

function SortableRow({
  rule,
  onEdit,
  onDelete,
}: {
  rule: ImportRule;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useLocale();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: rule.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-900"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none text-zinc-400 hover:text-zinc-600 active:cursor-grabbing dark:hover:text-zinc-300"
        aria-label={t("importRules.dragHandle")}
      >
        <GripVertical className="size-4" />
      </button>

      {/* Keyword */}
      <span className="w-40 truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">{rule.keyword}</span>

      {/* Kind badge */}
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          rule.kind === "expense"
            ? "bg-red-100 text-red-700"
            : "bg-green-100 text-green-700"
        }`}
      >
        {t(`categories.kind.${rule.kind}`)}
      </span>

      {/* Category */}
      <span className="flex-1 truncate text-sm text-zinc-600 dark:text-zinc-400">
        {rule.categories?.icon ? `${rule.categories.icon} ` : ""}
        {rule.categories?.name ?? "—"}
      </span>

      {/* Actions */}
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("importRules.editRule")} title={t("common.actions.edit")}>
          <Pencil />
        </Button>
        <Button variant="destructive" size="icon-sm" onClick={onDelete} aria-label={t("importRules.deleteRule")} title={t("common.actions.delete")}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

export function ImportRulesList() {
  const { t } = useLocale();
  const [rules, setRules] = useState<ImportRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRule, setEditingRule] = useState<ImportRule | null>(null);
  const [deletingRule, setDeletingRule] = useState<ImportRule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));

  const loadRules = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch("/api/import-rules");
    if (res.ok) {
      const data = (await res.json()) as { rules: ImportRule[] };
      setRules(data.rules ?? []);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void loadRules();
  }, [loadRules]);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = rules.findIndex((r) => r.id === active.id);
    const newIndex = rules.findIndex((r) => r.id === over.id);
    const reordered = arrayMove(rules, oldIndex, newIndex);

    setRules(reordered); // Optimistic update

    await fetch("/api/import-rules/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((r) => r.id) }),
    });
  };

  const handleDelete = async () => {
    if (!deletingRule) return;
    setIsDeleting(true);
    const res = await fetch(`/api/import-rules/${deletingRule.id}`, { method: "DELETE" });
    setIsDeleting(false);
    if (res.ok) {
      setDeletingRule(null);
      await loadRules();
    }
  };

  if (isLoading) {
    return <p className="py-8 text-center text-sm text-zinc-500">{t("common.state.loading")}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">
            {rules.length} {rules.length !== 1 ? t("importRules.countPlural") : t("importRules.countSingular")}
          </p>
          {rules.length > 1 && (
            <p className="text-xs text-zinc-400">{t("importRules.reorderHint")}</p>
          )}
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + {t("importRules.newRule")}
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {t("importRules.empty")}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
          <SortableContext items={rules.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {rules.map((rule) => (
                <SortableRow
                  key={rule.id}
                  rule={rule}
                  onEdit={() => setEditingRule(rule)}
                  onDelete={() => setDeletingRule(rule)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {showCreate && (
        <ImportRulesModal
          onSuccess={async () => {
            setShowCreate(false);
            await loadRules();
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {editingRule && (
        <ImportRulesModal
          ruleId={editingRule.id}
          defaultValues={editingRule}
          onSuccess={async () => {
            setEditingRule(null);
            await loadRules();
          }}
          onClose={() => setEditingRule(null)}
        />
      )}

      <AlertDialog
        open={deletingRule !== null}
        onOpenChange={(open) => !open && setDeletingRule(null)}
        title={t("importRules.deleteConfirmTitle")}
        description={deletingRule ? t("importRules.deleteConfirmDescription", { keyword: deletingRule.keyword }) : undefined}
        onConfirm={handleDelete}
        isConfirming={isDeleting}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
      />
    </div>
  );
}
