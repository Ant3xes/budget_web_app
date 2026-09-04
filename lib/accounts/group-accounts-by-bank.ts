import { ACCOUNT_TYPES } from "@/lib/constants";

export type BankAccountGroup<T> = {
  /** `null` = accounts with no bank set (accounts.bank is nullable free text). */
  bank: string | null;
  accounts: T[];
};

/**
 * Groups accounts by `bank` for the accounts list page. Mirrors the
 * bank-grouping precedent in `group-account-balances.ts` (used by the
 * dashboard's "Comptes par banque" widget) — banks sorted alphabetically
 * (fr collation), with a trailing group for accounts with no bank set —
 * but generic over the account shape (no `balanceCents`/subtotal needed
 * here) and additionally sorts each group's accounts by account type in
 * `ACCOUNT_TYPES` order, then by name.
 */
export function groupAccountsByBank<T extends { bank: string | null; type: string; name: string }>(
  accounts: T[]
): BankAccountGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const account of accounts) {
    const key = account.bank ?? "";
    const existing = groups.get(key);
    if (existing) {
      existing.push(account);
    } else {
      groups.set(key, [account]);
    }
  }

  return Array.from(groups.entries())
    .map(([key, accs]) => ({
      bank: key === "" ? null : key,
      accounts: [...accs].sort((a, b) => {
        const typeDiff =
          ACCOUNT_TYPES.indexOf(a.type as (typeof ACCOUNT_TYPES)[number]) -
          ACCOUNT_TYPES.indexOf(b.type as (typeof ACCOUNT_TYPES)[number]);
        if (typeDiff !== 0) return typeDiff;
        return a.name.localeCompare(b.name, "fr");
      }),
    }))
    .sort((a, b) => {
      if (a.bank === null) return b.bank === null ? 0 : 1;
      if (b.bank === null) return -1;
      return a.bank.localeCompare(b.bank, "fr");
    });
}
