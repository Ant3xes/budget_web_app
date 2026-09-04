import { describe, expect, it } from "vitest";

import { groupAccountBalancesByBank } from "@/lib/accounts/group-account-balances";

describe("groupAccountBalancesByBank", () => {
  const accounts = [
    { id: "1", name: "BNP Compte courant", type: "courant", bank: "BNP", balanceCents: 150000 },
    { id: "2", name: "PEL CIC", type: "PEL", bank: "CIC", balanceCents: 500000 },
    { id: "3", name: "Livret A", type: "livret", bank: null, balanceCents: 200000 },
    { id: "4", name: "N26 Perso", type: "courant", bank: "N26", balanceCents: 30000 },
  ];

  it("groups accounts by bank, sorted alphabetically", () => {
    const result = groupAccountBalancesByBank(accounts);
    expect(result.map((g) => g.bank)).toEqual(["BNP", "CIC", "N26", null]);
  });

  it("sums the total per bank group", () => {
    const result = groupAccountBalancesByBank(accounts);
    expect(result.find((g) => g.bank === "BNP")?.totalCents).toBe(150000);
  });

  it("puts accounts with no bank in a trailing null group", () => {
    const result = groupAccountBalancesByBank(accounts);
    const last = result[result.length - 1];
    expect(last?.bank).toBeNull();
    expect(last?.accounts.map((a) => a.id)).toEqual(["3"]);
  });

  it("merges multiple accounts under the same bank", () => {
    const result = groupAccountBalancesByBank([
      ...accounts,
      { id: "5", name: "N26 Commun", type: "courant", bank: "N26", balanceCents: 45000 },
    ]);
    const n26 = result.find((g) => g.bank === "N26");
    expect(n26?.accounts).toHaveLength(2);
    expect(n26?.totalCents).toBe(75000);
  });

  it("returns an empty array for no accounts", () => {
    expect(groupAccountBalancesByBank([])).toEqual([]);
  });
});
