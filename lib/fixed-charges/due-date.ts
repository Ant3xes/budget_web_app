/**
 * Shared by components/fixed-charges/fixed-charges-list.tsx (the full
 * management table) and components/dashboard/fixed-charges-summary.tsx (the
 * compact dashboard widget) — previously only defined in the former.
 */
export function isDueSoon(iso: string): boolean {
  const due = new Date(iso + "T00:00:00Z");
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  return due <= in7;
}

export function formatFixedChargeDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}
