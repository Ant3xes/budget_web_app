"use client";

import { useState } from "react";

import { ImportModal } from "@/components/import/import-modal";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function AccountsImportButton() {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        {t("accounts.list.importButton")}
      </Button>
      {isOpen && (
        <ImportModal
          onSuccess={() => setIsOpen(false)}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
