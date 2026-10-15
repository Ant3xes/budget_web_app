"use client";

import { useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { createCategoryForImport, type ImportCategory } from "@/lib/import/create-category";

interface NewCategoryFormProps {
  kind: "expense" | "income";
  onCreated: (category: ImportCategory, categories: ImportCategory[]) => void;
  onCancel: () => void;
}

// Inline mini-form (issue 119): creates a category in place; the parent
// refreshes its local list and selects it, without touching the preview.
export function NewCategoryForm({ kind, onCreated, onCancel }: NewCategoryFormProps) {
  const { t } = useLocale();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setError(null);
    setIsSaving(true);
    const result = await createCategoryForImport(name, kind);
    setIsSaving(false);
    if (result.ok) {
      onCreated(result.category, result.categories);
      return;
    }
    setError(
      result.reason === "empty"
        ? t("transactions.importModal.newCategoryEmpty")
        : result.reason === "duplicate"
          ? t("transactions.importModal.newCategoryDuplicate")
          : t("transactions.importModal.newCategoryError"),
    );
  };

  return (
    <div className="space-y-1 rounded-md border border-border px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <input
          autoFocus
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={t("transactions.importModal.newCategoryNamePlaceholder")}
          aria-label={t("transactions.importModal.newCategoryNamePlaceholder")}
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
        />
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void submit()}
          className="rounded bg-primary px-2 py-1 text-primary-foreground disabled:opacity-50"
        >
          {isSaving ? t("transactions.importModal.newCategoryCreating") : t("transactions.importModal.newCategoryCreate")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-zinc-300 px-2 py-1 dark:border-zinc-600 dark:text-zinc-300"
        >
          {t("transactions.importModal.newCategoryCancel")}
        </button>
      </div>
      {error ? <p role="alert" className="text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
