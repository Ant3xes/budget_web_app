"use client";

import { useId } from "react";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

interface ImportButtonProps {
  label: string;
  /** Au moins un compte existe dans l'espace ; sinon l'import est impossible (issue 102). */
  hasAccount: boolean;
  onImport: () => void;
  /** Ouvre le même flux que « Nouveau compte ». */
  onCreateAccount: () => void;
}

/**
 * Bouton « Importer » partagé par /accounts et /transactions. Sans compte, il
 * est désactivé et un message (relié par aria-describedby) renvoie vers la
 * création de compte (issue 102).
 */
export function ImportButton({ label, hasAccount, onImport, onCreateAccount }: ImportButtonProps) {
  const { t } = useLocale();
  const messageId = useId();

  if (hasAccount) {
    return (
      <Button variant="outline" onClick={onImport}>
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" disabled aria-describedby={messageId}>
        {label}
      </Button>
      <p id={messageId} className="text-sm text-zinc-500 dark:text-zinc-400">
        {t("accounts.list.importNeedsAccount")}{" "}
        <button type="button" onClick={onCreateAccount} className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-100">
          {t("accounts.list.createAccount")}
        </button>
      </p>
    </div>
  );
}
