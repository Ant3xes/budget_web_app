"use client";

import { AccountForm, type AccountFormValues } from "@/components/accounts/account-form";

interface AccountModalProps {
  accountId?: string;
  defaultValues?: AccountFormValues;
  onClose: () => void;
  onSuccess: () => void;
}

export function AccountModal({ accountId, defaultValues, onClose, onSuccess }: AccountModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <h2 className="text-base font-semibold">
            {accountId ? "Modifier le compte" : "Nouveau compte"}
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
          <AccountForm
            accountId={accountId}
            defaultValues={defaultValues}
            onSuccess={onSuccess}
          />
        </div>
      </div>
    </div>
  );
}
