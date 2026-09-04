export type AccountBalance = {
  id: string;
  name: string;
  type: string;
  bank: string | null;
  balanceCents: number;
};

export type BankGroup = {
  /** `null` = accounts with no bank set (accounts.bank, plan §Étape 3). */
  bank: string | null;
  accounts: AccountBalance[];
  totalCents: number;
};

/**
 * Groups account balances by `bank` for the dashboard's "soldes de comptes
 * groupés par banque" widget (plan §Étape 3). Banks are sorted
 * alphabetically (fr); accounts with no bank set form a trailing group.
 */
export function groupAccountBalancesByBank(accounts: AccountBalance[]): BankGroup[] {
  const groups = new Map<string, AccountBalance[]>();

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
      accounts: accs,
      totalCents: accs.reduce((sum, a) => sum + a.balanceCents, 0),
    }))
    .sort((a, b) => {
      if (a.bank === null) return b.bank === null ? 0 : 1;
      if (b.bank === null) return -1;
      return a.bank.localeCompare(b.bank, "fr");
    });
}
