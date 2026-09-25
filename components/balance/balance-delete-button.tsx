"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * A destructive action behind a confirmation dialog (unshare an expense,
 * delete a settlement). Same pattern as `SpaceActionButton`: i18n KEYS come
 * as props because the page is a Server Component and cannot call `t()`.
 */
export function BalanceDeleteButton({
  url,
  labelKey,
  confirmTitleKey,
  confirmDescriptionKey,
  errorKey,
  cancelKey,
}: {
  url: string;
  labelKey: string;
  confirmTitleKey: string;
  confirmDescriptionKey: string;
  errorKey: string;
  cancelKey: string;
}) {
  const router = useRouter();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = t(labelKey);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, { method: "DELETE" });
      if (!response.ok) {
        setError(t(errorKey));
        return;
      }
      router.refresh();
    } catch {
      setError(t(errorKey));
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <>
      <Button variant="destructive" size="xs" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        title={t(confirmTitleKey)}
        description={t(confirmDescriptionKey)}
        confirmLabel={label}
        cancelLabel={t(cancelKey)}
        onConfirm={() => void confirm()}
        isConfirming={busy}
      />
    </>
  );
}
