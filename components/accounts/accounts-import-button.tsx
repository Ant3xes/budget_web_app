"use client";

import { useState } from "react";

import { ImportModal } from "@/components/import/import-modal";

export function AccountsImportButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        Importer
      </button>
      {isOpen && (
        <ImportModal
          onSuccess={() => setIsOpen(false)}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
