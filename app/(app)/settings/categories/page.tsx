"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { CategoryBadge } from "@/components/category-badge";
import { CategoryModal } from "@/components/settings/category-modal";
import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { resolveCategoryName } from "@/lib/i18n/category-name";

type Category = {
  id: string;
  name: string;
  kind: "expense" | "income" | "transfer";
  color: string | null;
  icon: string | null;
  is_default: boolean;
  translation_key: string | null;
};

export default function CategoriesPage() {
  const { t } = useLocale();
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

  // Dépense/Revenu side by side (the request: "afficher dépense et revenu en
  // même temps" — previously a vertical stack of 3 sections requiring
  // scrolling to see income after expense); virement spans full width below
  // since a 3rd column would cramp the two lists that matter most day to day.
  const kindSection = (kind: "expense" | "income" | "transfer") => {
    const items = grouped[kind] ?? [];
    return (
      <article key={kind} className="rounded-lg bg-white p-4 shadow-sm dark:bg-zinc-900">
        <h2 className="mb-3 text-base font-medium">{t(`categories.kind.${kind}`)}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-400">{t("settings.categories.emptyForKind")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((cat) => (
              <div
                key={cat.id}
                title={resolveCategoryName(cat, t)}
                className="group relative flex flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 pt-7 pb-3 text-center dark:border-zinc-700 dark:bg-zinc-950"
              >
                <div className="absolute right-1 top-1 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingId(cat.id)}
                    aria-label={t("common.actions.edit")}
                    title={t("common.actions.edit")}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => setDeletingCategory(cat)}
                    aria-label={t("common.actions.delete")}
                    title={t("common.actions.delete")}
                  >
                    <Trash2 />
                  </Button>
                </div>
                <CategoryBadge
                  name={resolveCategoryName(cat, t)}
                  color={cat.color}
                  icon={cat.icon}
                  className="flex-col text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("settings.categories.title")}</h1>
        <button
          onClick={() => {
            setShowCreate(true);
            setEditingId(null);
          }}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white"
        >
          {t("settings.categories.newButton")}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500">{t("common.state.loading")}</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            {kindSection("expense")}
            {kindSection("income")}
          </div>
          {kindSection("transfer")}
        </div>
      )}

      <AlertDialog
        open={deletingCategory !== null}
        onOpenChange={(open) => !open && setDeletingCategory(null)}
        title={t("settings.categories.deleteConfirmTitle")}
        description={
          deletingCategory
            ? t("settings.categories.deleteConfirmDescription", { name: resolveCategoryName(deletingCategory, t) })
            : undefined
        }
        onConfirm={handleDelete}
        isConfirming={isDeleting}
        confirmLabel={t("common.actions.delete")}
        cancelLabel={t("common.actions.cancel")}
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
