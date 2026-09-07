"use client";

import { useLocale } from "@/components/locale-provider";

/**
 * Translates an invitation's raw `status` ("pending"/"accepted") for
 * app/(app)/invitations/page.tsx — an async Server Component that can't call
 * `useLocale()` itself, so this is the smallest client boundary that lets
 * the status label follow the locale. Falls back to the raw value for any
 * future/unknown status rather than throwing.
 */
export function InvitationStatusLabel({ status }: { status: string }) {
  const { t } = useLocale();
  if (status === "pending") return <>{t("invitations.status.pending")}</>;
  if (status === "accepted") return <>{t("invitations.status.accepted")}</>;
  return <>{status}</>;
}
