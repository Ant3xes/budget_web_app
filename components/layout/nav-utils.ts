import { NAV_ITEMS, type NavItemDef } from "@/lib/constants";

/** Cookie qui mémorise l'état replié de la sidebar desktop (lu côté serveur par le layout). */
export const SIDEBAR_COOKIE = "sidebar_collapsed";

export type NavItem = (typeof NAV_ITEMS)[number];

/** Entrées toujours visibles dans la barre du bas mobile ; le reste passe par le sheet « Plus ». */
export const PRIMARY_NAV_KEYS: readonly NavItem["key"][] = ["dashboard", "transactions", "accounts", "budget"];

export const PRIMARY_NAV_ITEMS = NAV_ITEMS.filter((item) => PRIMARY_NAV_KEYS.includes(item.key));
export const SECONDARY_NAV_ITEMS = NAV_ITEMS.filter((item) => !PRIMARY_NAV_KEYS.includes(item.key));

/** Même règle de préfixe que l'ancienne top-nav (#37) : /transactions/123 active « Transactions ». */
export function isNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Masque les entrées `sharedOnly` (ex. Solde) tant que l'espace actif est personnel. */
export function visibleNavItems<T extends NavItemDef>(items: readonly T[], isShared: boolean): T[] {
  return items.filter((item) => isShared || !item.sharedOnly);
}
