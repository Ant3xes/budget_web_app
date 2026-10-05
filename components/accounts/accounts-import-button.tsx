"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccountModal } from "@/components/accounts/account-modal";
import { ImportButton } from "@/components/import/import-button";
import { ImportModal } from "@/components/import/import-modal";
import { useLocale } from "@/components/locale-provider";

export function AccountsImportButton({
  spaceKind = "personal",
  hasAccount,
}: {
  spaceKind?: "personal" | "shared";
  /** Calculé dans app/(app)/accounts/page.tsx (issue 102). */
  hasAccount: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <ImportButton
        label={t("accounts.list.importButton")}
        hasAccount={hasAccount}
        onImport={() => setIsOpen(true)}
        onCreateAccount={() => setCreateOpen(true)}
      />
      {isOpen && (
        <ImportModal
          spaceKind={spaceKind}
          onSuccess={() => setIsOpen(false)}
          onClose={() => setIsOpen(false)}
        />
      )}
      {createOpen && (
        <AccountModal
          onClose={() => setCreateOpen(false)}
          onSuccess={() => {
            setCreateOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
