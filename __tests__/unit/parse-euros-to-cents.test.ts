import { describe, expect, it } from "vitest";

import { createAccountFormSchema } from "@/lib/accounts/account-form-schema";
import { formatCentsToEuros, parseEurosToCents } from "@/lib/accounts/parse-euros-to-cents";

describe("parseEurosToCents (issue 103)", () => {
  it.each([
    ["12,5", 1250],
    ["12.5", 1250],
    ["1 234,56", 123456],
    ["1234.56", 123456],
    ["-50", -5000],
    ["0", 0],
    ["", 0],
    ["   ", 0],
    ["19,99", 1999],
    ["1,15", 115],
    ["0.29", 29],
    ["-0,001", 0],
  ])("%j → %j cents", (input, expected) => {
    expect(parseEurosToCents(input)).toBe(expected);
  });

  it.each(["abc", "12,3,4x", "--5", "1e999", "€"])("%j is invalid → null", (input) => {
    expect(parseEurosToCents(input)).toBeNull();
  });

  it("never returns -0", () => {
    expect(Object.is(parseEurosToCents("-0"), 0)).toBe(true);
  });
});

describe("formatCentsToEuros", () => {
  it.each([
    [1999, "19,99"],
    [1250, "12,50"],
    [5, "0,05"],
    [0, "0"],
    [-5000, "-50"],
    [-1999, "-19,99"],
    [123456, "1234,56"],
  ])("%j → %j", (cents, expected) => {
    expect(formatCentsToEuros(cents)).toBe(expected);
  });

  it("round-trips through parseEurosToCents (save without touching keeps the value)", () => {
    for (const cents of [1999, 1, 99, 100, -1, -1999, 123456, 0, 29, 115]) {
      expect(parseEurosToCents(formatCentsToEuros(cents))).toBe(cents);
    }
  });
});

describe("account form schema", () => {
  const schema = createAccountFormSchema({ nameRequired: "nom", invalidBalance: "montant invalide" });
  const base = { name: "Courant", type: "courant", bank: "", currency: "EUR" };

  it("transforms the euro text into initialBalanceCents", () => {
    const result = schema.safeParse({ ...base, initialBalance: "1 234,56" });
    expect(result.success && result.data.initialBalanceCents).toBe(123456);
  });

  it("treats an empty balance as 0", () => {
    const result = schema.safeParse({ ...base, initialBalance: "" });
    expect(result.success && result.data.initialBalanceCents).toBe(0);
  });

  it("rejects abc on the initialBalance field (so no request is sent)", () => {
    const result = schema.safeParse({ ...base, initialBalance: "abc" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]).toMatchObject({ path: ["initialBalance"], message: "montant invalide" });
    }
  });
});
