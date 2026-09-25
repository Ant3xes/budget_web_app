"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * A destructive space action behind a confirmation dialog: leave a space,
 * remove a member or delete the space. `url` is the DELETE endpoint; the
 * three actions differ only by that and by their i18n keys (passed as keys,
 * not strings, because the caller is a Server Component and cannot call
 * `t()` itself).
 */
export function SpaceActionButton({
  url,
  labelKey,
  confirmTitleKey,
  confirmDescriptionKey,
  size = "sm",
}: {
  url: string;
  labelKey: string;
  confirmTitleKey: string;
  confirmDescriptionKey: string;
  size?: "sm" | "xs";
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
    const response = await fetch(url, { method: "DELETE" });
    setBusy(false);

    if (!response.ok) {
      setOpen(false);
      setError(t("invitations.danger.error"));
      return;
    }

    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button variant="destructive" size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
      <AlertDialog
        open={open}
        onOpenChange={setOpen}
        title={t(confirmTitleKey)}
        description={t(confirmDescriptionKey)}
        confirmLabel={label}
        cancelLabel={t("invitations.danger.cancel")}
        onConfirm={() => void confirm()}
        isConfirming={busy}
      />
    </>
  );
}
