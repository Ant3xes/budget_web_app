import { describe, expect, it } from "vitest";

import { groupAccountsByBank } from "@/lib/accounts/group-accounts-by-bank";

describe("groupAccountsByBank", () => {
  const accounts = [
    { id: "1", name: "BNP Livret", type: "livret", bank: "BNP" },
    { id: "2", name: "BNP Compte courant", type: "courant", bank: "BNP" },
    { id: "3", name: "PEL CIC", type: "PEL", bank: "CIC" },
    { id: "4", name: "Livret A", type: "livret", bank: null },
    { id: "5", name: "N26 Perso", type: "courant", bank: "N26" },
  ];

  it("groups accounts by bank, sorted alphabetically with no-bank trailing", () => {
    const result = groupAccountsByBank(accounts);
    expect(result.map((g) => g.bank)).toEqual(["BNP", "CIC", "N26", null]);
  });

  it("sorts accounts within a bank group by account type order, then name", () => {
    const result = groupAccountsByBank(accounts);
    const bnp = result.find((g) => g.bank === "BNP");
    // "courant" comes before "livret" in ACCOUNT_TYPES, regardless of input order.
    expect(bnp?.accounts.map((a) => a.id)).toEqual(["2", "1"]);
  });

  it("breaks ties within the same type by name (fr locale)", () => {
    const result = groupAccountsByBank([
      { id: "a", name: "Épargne Zoé", type: "épargne", bank: "SG" },
      { id: "b", name: "Épargne Adèle", type: "épargne", bank: "SG" },
    ]);
    const sg = result.find((g) => g.bank === "SG");
    expect(sg?.accounts.map((a) => a.id)).toEqual(["b", "a"]);
  });

  it("puts accounts with no bank in a trailing null group", () => {
    const result = groupAccountsByBank(accounts);
    const last = result[result.length - 1];
    expect(last?.bank).toBeNull();
    expect(last?.accounts.map((a) => a.id)).toEqual(["4"]);
  });

  it("returns an empty array for no accounts", () => {
    expect(groupAccountsByBank([])).toEqual([]);
  });
});
