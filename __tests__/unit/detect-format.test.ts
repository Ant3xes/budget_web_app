import { describe, expect, it } from "vitest";

import { detectFormat } from "@/lib/import/detect-format";

describe("detectFormat", () => {
  it("detects N26 format", () => {
    expect(detectFormat(["Booking Date", "Payee", "Amount (EUR)"])).toBe("n26");
    expect(detectFormat(["booking date", "amount (eur)", "other"])).toBe("n26");
  });

  it("detects BNP format", () => {
    expect(detectFormat(["Date operation", "Libelle operation", "Montant"])).toBe("bnp");
    expect(detectFormat(["date operation"])).toBe("bnp");
  });

  it("returns unknown for unrecognized headers", () => {
    expect(detectFormat(["Date", "Amount", "Description"])).toBe("unknown");
    expect(detectFormat([])).toBe("unknown");
  });

  it("is case-insensitive", () => {
    expect(detectFormat(["BOOKING DATE", "AMOUNT (EUR)"])).toBe("n26");
    expect(detectFormat(["DATE OPERATION"])).toBe("bnp");
  });
});
