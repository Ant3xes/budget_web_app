"use client";

import { AccountForm, type AccountFormValues } from "@/components/accounts/account-form";
import { useLocale } from "@/components/locale-provider";
import { Modal } from "@/components/ui/modal";

interface AccountModalProps {
  accountId?: string;
  defaultValues?: AccountFormValues;
  onClose: () => void;
  onSuccess: () => void;
}

export function AccountModal({ accountId, defaultValues, onClose, onSuccess }: AccountModalProps) {
  const { t } = useLocale();
  return (
    <Modal
      open
      onOpenChange={(next) => !next && onClose()}
      title={accountId ? t("accounts.form.editTitle") : t("accounts.form.newTitle")}
      closeLabel={t("common.actions.close")}
    >
      {!accountId && (
        // Issue 104 (ADR 0003): explains the balance anchor date at creation.
        <p className="mb-3 text-sm text-zinc-500 dark:text-zinc-400">{t("accounts.list.balanceAnchorHelp")}</p>
      )}
      <AccountForm accountId={accountId} defaultValues={defaultValues} onSuccess={onSuccess} />
    </Modal>
  );
}
