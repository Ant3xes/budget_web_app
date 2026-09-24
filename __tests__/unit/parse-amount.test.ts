import { describe, expect, it } from "vitest";

import { parseAmount } from "@/lib/import/parse-amount";

describe("parseAmount", () => {
  it.each([
    ["-15.99", -15.99],
    ["2500.00", 2500],
    ["-1 234,56", -1234.56], // BNP: space thousands, decimal comma
    ["1 234,56", 1234.56], // non-breaking space
    ["-1.234,56", -1234.56], // dot thousands, decimal comma
    ["1,234.56", 1234.56], // comma thousands, decimal dot
    ["-1,234,567.89", -1234567.89],
    ["1.234.567,89", 1234567.89],
    ["-12,5", -12.5],
    ["+42", 42],
    ["−12,50", -12.5], // typographic minus
    ["12,50 €", 12.5], // currency symbol
    ["1.234.567", 1234567], // several dots: thousands
  ])("%s → %d", (raw, expected) => {
    expect(parseAmount(raw)).toBeCloseTo(expected, 2);
  });

  it.each(["", "abc", "--5", "1,2,3x", "."])("%j is not a number", (raw) => {
    expect(parseAmount(raw)).toBeNaN();
  });
});
