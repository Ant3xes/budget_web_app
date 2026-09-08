"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { CategoryBadge } from "@/components/category-badge";
import { CategoryModal } from "@/components/settings/category-modal";
import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resolveCategoryName } from "@/lib/i18n/category-name";
import { CATEGORY_COLOR_FALLBACK } from "@/lib/constants";

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
      <Card key={kind} className="px-(--card-spacing)">
        <h2 className="mb-3 text-base font-medium">{t(`categories.kind.${kind}`)}</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.categories.emptyForKind")}</p>
        ) : (
          // auto-fill/minmax instead of viewport breakpoints (sm:/lg:) —
          // this grid sits inside a column that's already halved by the
          // Dépense/Revenu split above md:, so a viewport-based breakpoint
          // would size columns off the *page* width, not the space this
          // grid actually has, packing 3-4 columns into a half-width
          // section and wrapping every multi-word name. auto-fill sizes
          // off the container itself, however narrow.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
            {items.map((cat) => {
              const accentColor = cat.color ?? CATEGORY_COLOR_FALLBACK;
              return (
                <Card
                  key={cat.id}
                  interactive
                  title={resolveCategoryName(cat, t)}
                  className="group relative flex min-w-0 flex-col items-center gap-1 px-2.5 pb-4 pt-9 text-center"
                >
                  {/* Bande d'accent colorée en haut de la card, clippée par overflow-hidden + rounded-2xl du conteneur */}
                  <span aria-hidden className="absolute inset-x-0 top-0 z-0 h-1.5" style={{ backgroundColor: accentColor }} />
                  {/* Halo doux derrière l'icône, teinté avec la couleur de la catégorie */}
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-7 z-0 h-10 w-10 -translate-x-1/2 rounded-full"
                    style={{ backgroundColor: `color-mix(in srgb, ${accentColor} 20%, transparent)` }}
                  />
                  <div className="absolute right-1 top-2.5 z-20 flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
                    className="relative z-10 w-full min-w-0 flex-col break-words text-sm"
                  />
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{t("settings.categories.title")}</h1>
        <Button
          onClick={() => {
            setShowCreate(true);
            setEditingId(null);
          }}
        >
          {t("settings.categories.newButton")}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.state.loading")}</p>
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
