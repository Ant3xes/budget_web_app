"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { Pencil, Trash2 } from "lucide-react";

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
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-base font-semibold">{t(`categories.kind.${kind}`)}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {items.length}
          </span>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("settings.categories.emptyForKind")}</p>
        ) : (
          // auto-fill/minmax sizes columns off the container itself (this
          // grid sits inside a column already halved by the Dépense/Revenu
          // split above md:), not off the viewport.
          <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-3">
            {items.map((cat) => {
              const accentColor = cat.color ?? CATEGORY_COLOR_FALLBACK;
              const name = resolveCategoryName(cat, t);
              return (
                <Card
                  key={cat.id}
                  interactive
                  title={name}
                  className="group relative flex-row items-center gap-3 p-3 ring-1 hover:ring-(--cat-accent)/40"
                  style={{ "--cat-accent": accentColor } as CSSProperties}
                >
                  {/* Soft accent wash fading out from the top-left corner */}
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 12%, transparent), transparent 60%)` }}
                  />
                  <span
                    aria-hidden
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg shadow-sm ring-1 ring-inset"
                    style={{
                      backgroundColor: `color-mix(in srgb, ${accentColor} 18%, var(--card))`,
                      color: accentColor,
                      ["--tw-ring-color" as string]: `color-mix(in srgb, ${accentColor} 30%, transparent)`,
                    }}
                  >
                    {cat.icon ?? <span className="h-3 w-3 rounded-full" style={{ backgroundColor: accentColor }} />}
                  </span>
                  <span className="relative min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                  {/* Always visible on touch (no hover), revealed on hover/focus on desktop */}
                  <div className="relative z-10 flex shrink-0 gap-0.5 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
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
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setDeletingCategory(cat)}
                      aria-label={t("common.actions.delete")}
                      title={t("common.actions.delete")}
                    >
                      <Trash2 />
                    </Button>
                  </div>
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
