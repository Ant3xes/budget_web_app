"use client";

import { useCallback, useEffect, useState } from "react";

import { CategoryForm } from "@/components/settings/category-form";

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

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer cette catégorie ?")) return;
    const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    }
  };

  const grouped = categories.reduce<Record<string, Category[]>>((acc, cat) => {
    (acc[cat.kind] ??= []).push(cat);
    return acc;
  }, {});

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

      {showCreate && (
        <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="mb-3 text-base font-medium">Nouvelle catégorie</h2>
          <CategoryForm
            onSuccess={() => {
              setShowCreate(false);
              void load();
            }}
            onCancel={() => setShowCreate(false)}
          />
        </article>
      )}

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
                      {editingId === cat.id ? (
                        <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
                          <CategoryForm
                            categoryId={cat.id}
                            defaultValues={{
                              name: cat.name,
                              kind: cat.kind,
                              color: cat.color ?? undefined,
                              icon: cat.icon ?? undefined,
                            }}
                            onSuccess={() => {
                              setEditingId(null);
                              void load();
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-zinc-50">
                          <div className="flex items-center gap-3">
                            <span
                              className="h-4 w-4 rounded-full flex-shrink-0"
                              style={{ backgroundColor: cat.color ?? "#94a3b8" }}
                            />
                            <span className="text-sm">
                              {cat.icon ? `${cat.icon} ` : ""}
                              {cat.name}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingId(cat.id)}
                              className="rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:text-zinc-300"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(cat.id)}
                              className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                            >
                              Supprimer
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}
