"use client";

import { useState } from "react";

import { ImportModal } from "@/components/import/import-modal";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function AccountsImportButton({ spaceKind = "personal" }: { spaceKind?: "personal" | "shared" }) {
  const { t } = useLocale();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setIsOpen(true)}>
        {t("accounts.list.importButton")}
      </Button>
      {isOpen && (
        <ImportModal
          spaceKind={spaceKind}
          onSuccess={() => setIsOpen(false)}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
