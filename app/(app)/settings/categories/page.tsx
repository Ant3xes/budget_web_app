"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { CategoryModal } from "@/components/settings/category-modal";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CATEGORY_COLOR_FALLBACK } from "@/lib/constants";

type Category = {
  id: string;
  name: string;
  kind: "expense" | "income" | "transfer";
  color: string | null;
  icon: string | null;
};

const KIND_LABELS: Record<string, string> = {
  expense: "Dépense",
  income: "Revenu",
  transfer: "Virement",
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const res = await fetch("/api/categories");
    if (res.ok) {
      const data = (await res.json()) as { categories: Category[] };
      setCategories(data.categories);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    void load();
  }, [load]);

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    const res = await fetch(`/api/categories/${deletingCategory.id}`, { method: "DELETE" });
    setIsDeleting(false);
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== deletingCategory.id));
      setDeletingCategory(null);
    }
  };

  const grouped = categories.reduce<Record<string, Category[]>>((acc, cat) => {
    (acc[cat.kind] ??= []).push(cat);
    return acc;
  }, {});

  const editingCategory = editingId ? (categories.find((c) => c.id === editingId) ?? null) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Catégories</h1>
        <button
          onClick={() => {
            setShowCreate(true);
            setEditingId(null);
          }}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          + Nouvelle catégorie
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500">Chargement…</p>
      ) : (
        (["expense", "income", "transfer"] as const).map((kind) => {
          const items = grouped[kind] ?? [];
          return (
            <article key={kind} className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
              <h2 className="mb-3 text-base font-medium">{KIND_LABELS[kind]}</h2>
              {items.length === 0 ? (
                <p className="text-sm text-zinc-400">Aucune catégorie</p>
              ) : (
                <ul className="space-y-2">
                  {items.map((cat) => (
                    <li key={cat.id}>
                      <div className="group flex items-center justify-between rounded-md px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-4 w-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: cat.color ?? CATEGORY_COLOR_FALLBACK }}
                          />
                          <span className="text-sm">
                            {cat.icon ? `${cat.icon} ` : ""}
                            {cat.name}
                          </span>
                        </div>
                        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditingId(cat.id)}
                            aria-label="Modifier la catégorie"
                            title="Modifier"
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            onClick={() => setDeletingCategory(cat)}
                            aria-label="Supprimer la catégorie"
                            title="Supprimer"
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })
      )}

      <AlertDialog
        open={deletingCategory !== null}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
        title="Supprimer cette catégorie ?"
        description={deletingCategory ? `La catégorie "${deletingCategory.name}" sera supprimée.` : undefined}
        onConfirm={handleDelete}
        isConfirming={isDeleting}
      />

      {showCreate && (
        <CategoryModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            void load();
          }}
        />
      )}

      {editingCategory && (
        <CategoryModal
          categoryId={editingCategory.id}
          defaultValues={{
            name: editingCategory.name,
            kind: editingCategory.kind,
            color: editingCategory.color ?? undefined,
            icon: editingCategory.icon ?? undefined,
          }}
          onClose={() => setEditingId(null)}
          onSuccess={() => {
            setEditingId(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
