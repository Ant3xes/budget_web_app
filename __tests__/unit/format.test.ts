import { describe, expect, it } from "vitest";

import { formatEuros } from "@/lib/format";

describe("formatEuros", () => {
  it("formats cents as euros with the € symbol by default", () => {
    // fr-FR's Intl currency formatter separates the amount from the symbol
    // with a non-breaking space (U+00A0), not a plain space.
    expect(formatEuros(10000)).toBe("100,00 €");
  });

  it("formats using the given currency when one is passed", () => {
    expect(formatEuros(10000, "USD")).toBe("100,00 $US");
  });

  it("falls back to a plain amount + raw code instead of throwing on a malformed currency", () => {
    // `currency` is free text on the account form (any 3-char string, no
    // character-class check), and Intl's currency formatter throws for
    // anything that isn't 3 alpha characters — regression test for the
    // Dashboard & UX polish batch's code-review finding.
    expect(() => formatEuros(10000, "12x")).not.toThrow();
    expect(formatEuros(10000, "12x")).toBe("100,00 12x");
  });
});
