import { describe, expect, it } from "vitest";

import { matchMerchant, merchants } from "@/lib/import/merchants";

// Synthetic labels only (issue 130): bank-style noise around a merchant name
// taken from the database, plus labels that must stay unknown.
const WRAPPERS = [
  (m: string) => `PAIEMENT CB ${m.toUpperCase()} PARIS 12/03 CARTE*1234`,
  (m: string) => `PRELEVEMENT SEPA ${m.toUpperCase()} REF:000123`,
  (m: string) => `${m.toUpperCase()} 4821 CARD PAYMENT`,
];
const UNKNOWN = ["ZZQX TRUC 123", "VIREMENT DIVERS MACHIN", "RETRAIT DAB 45"];

describe("merchant recognition rate on synthetic labels", () => {
  it("recognises nearly every wrapped known-merchant label and no unknown one", () => {
    const labels = merchants.flatMap((m) => WRAPPERS.map((w) => ({ label: w(m.patterns[0]!), name: m.name })));
    const hits = labels.filter(({ label }) => matchMerchant(label) !== null);
    const rate = hits.length / labels.length;
    console.info(`merchant coverage: ${hits.length}/${labels.length} = ${(rate * 100).toFixed(1)}%`);
    expect(rate).toBeGreaterThanOrEqual(0.95);
    expect(UNKNOWN.filter((l) => matchMerchant(l))).toEqual([]);
  });
});
