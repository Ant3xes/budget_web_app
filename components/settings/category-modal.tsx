"use client";

import { CategoryForm, type CategoryFormValues } from "@/components/settings/category-form";

interface CategoryModalProps {
  categoryId?: string;
  defaultValues?: CategoryFormValues;
  onClose: () => void;
  onSuccess: () => void;
}

export function CategoryModal({ categoryId, defaultValues, onClose, onSuccess }: CategoryModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-base font-semibold">
            {categoryId ? "Modifier la catégorie" : "Nouvelle catégorie"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="p-4">
          <CategoryForm
            categoryId={categoryId}
            defaultValues={defaultValues}
            onSuccess={onSuccess}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
