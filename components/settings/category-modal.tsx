"use client";

import { useLocale } from "@/components/locale-provider";
import { CategoryForm, type CategoryFormValues } from "@/components/settings/category-form";
import { Modal } from "@/components/ui/modal";

interface CategoryModalProps {
  categoryId?: string;
  defaultValues?: CategoryFormValues;
  onClose: () => void;
  onSuccess: () => void;
}

export function CategoryModal({ categoryId, defaultValues, onClose, onSuccess }: CategoryModalProps) {
  const { t } = useLocale();
  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={categoryId ? t("settings.categories.modal.editTitle") : t("settings.categories.modal.newTitle")}
      closeLabel={t("common.actions.close")}
    >
      <CategoryForm
        categoryId={categoryId}
        defaultValues={defaultValues}
        onSuccess={onSuccess}
        onCancel={onClose}
      />
    </Modal>
  );
}
