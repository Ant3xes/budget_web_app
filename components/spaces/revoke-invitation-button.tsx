"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

export function RevokeInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);

  const revoke = async () => {
    setBusy(true);
    const response = await fetch(`/api/invitations/${invitationId}`, { method: "DELETE" });
    setBusy(false);
    if (response.ok) {
      router.refresh();
    }
  };

  return (
    <Button variant="ghost" size="xs" disabled={busy} onClick={() => void revoke()}>
      {t("invitations.revoke")}
    </Button>
  );
}
