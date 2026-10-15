import { describe, expect, it } from "vitest";

import { buildFileHashes } from "@/lib/import/deduplicate";
import { normalizeLabel } from "@/lib/import/normalize-label";

const bnp = (raw: string) => normalizeLabel(raw, { source: "bnp" }).clean;
const n26 = (raw: string) => normalizeLabel(raw, { source: "n26" }).clean;

describe("normalizeLabel — BNP", () => {
  it.each([
    ["PAIEMENT CB EXEMPLE MARKET DU 11/10/26 A PARIS 12 - CARTE*0000", "Exemple Market"],
    ["PAIEMENT CB SHOP TEST (IRLANDE) DU 13/07/26 - CARTE*0000", "Shop Test"],
    ["PAIEMENT CB SHOP TEST DU 13/07/26 CARTE*1234", "Shop Test"],
    ["PAIEMENT CB BOULANGERIE DU COIN DU 02/03/26 A LYON - CARTE*0000", "Boulangerie Du Coin"],
    ["PAIEMENT CB CAFE DE LA GARE DU 02/03/2026 A SAINT-ETIENNE - CARTE*0000", "Cafe De La Gare"],
    ["PAIEMENT CB LIBRAIRIE TEST DU 5/3/26 A NICE - CARTE*0000", "Librairie Test"],
    ["PAIEMENT CB PHARMACIE TEST DU 01/01/26 A PARIS 08 - CARTE*0000", "Pharmacie Test"],
    ["PAIEMENT CB SNCF VOYAGES DU 14/04/26 A PARIS - CARTE*0000", "SNCF Voyages"],
    ["PAIEMENT CB RESTAURANT L'ATELIER DU 14/04/26 A PARIS - CARTE*0000", "Restaurant L'Atelier"],
    ["PRELEVEMENT FOURNISSEUR DU 09/10/26 - EMETTEUR : FR00ZZZ000000 MDT - MOTIF : FACTURE 123 - REF : ABC123", "Fournisseur"],
    ["PRELEVEMENT FOURNISSEUR DU 09/10/26 - EMETTEUR : FR00ZZZ000000 MDT", "Fournisseur"],
    ["PRELEVEMENT EDF DU 09/10/26 - REF : 000111", "EDF"],
    ["PRELEVEMENT ASSURANCE EXEMPLE - MOTIF : COTISATION", "Assurance Exemple"],
    ["PRELEVEMENT SEPA OPERATEUR MOBILE DU 03/05/26", "Operateur Mobile"],
    ["PAIEMENT CB (FRANCE)", "PAIEMENT CB (FRANCE)"],
    ["VIR SEPA JEAN EXEMPLE", "Vir SEPA Jean Exemple"],
    ["Paiement Cb Deja Propre Du 11/10/26 A Paris - Carte*0000", "Deja Propre"],
    ["PAIEMENT   CB   MARCHE   TEST  DU 11/10/26  A  PARIS - CARTE*0000", "Marche Test"],
    ["COTISATION CARTE", "Cotisation Carte"],
    ["PAIEMENT CB ", "PAIEMENT CB"],
  ])("%s → %s", (raw, expected) => {
    expect(bnp(raw)).toBe(expected);
  });
});

describe("normalizeLabel — N26", () => {
  it.each([
    ["UBR* PENDING.EXEMPLE.COM", "Ubr exemple.com"],
    ["EXEMPLE *5B11U5HB5", "Exemple"],
    ["MARCHAND TEST*ADS7964900656", "Marchand Test"],
    ["MARCHAND   TEST", "Marchand Test"],
    ["Marchand Test", "Marchand Test"],
    ["Uber Eats", "Uber Eats"],
    ["SHOP TEST PENDING", "Shop Test"],
    ["SHOP TEST *1A2B3C4D", "Shop Test"],
    ["SNCF", "SNCF"],
    ["RATP PARIS", "RATP Paris"],
    ["PRO*SERVICE TEST", "Pro Service Test"],
    ["EXEMPLE.COM", "exemple.com"],
    ["Jean Exemple", "Jean Exemple"],
    ["BOULANGERIE-PATISSERIE TEST", "Boulangerie-Patisserie Test"],
    ["  espaces  autour  ", "espaces autour"],
    ["MARCHAND *ABCDEFGH", "Marchand *ABCDEFGH".replace(" *ABCDEFGH", " Abcdefgh")],
    ["LOYER", "Loyer"],
    ["7ELEVEN TEST", "7Eleven Test"],
  ])("%s → %s", (raw, expected) => {
    expect(n26(raw)).toBe(expected);
  });
});

describe("normalizeLabel — edge cases", () => {
  it("returns the raw label untouched", () => {
    const raw = "PAIEMENT CB SHOP TEST DU 13/07/26 - CARTE*0000";
    expect(normalizeLabel(raw, { source: "bnp" }).raw).toBe(raw);
  });

  it("handles an empty label", () => {
    expect(normalizeLabel("", { source: "bnp" })).toEqual({ clean: "", raw: "" });
    expect(normalizeLabel("   ", { source: "n26" }).clean).toBe("");
  });

  it("keeps digits-only labels", () => {
    expect(normalizeLabel("1234567", { source: "n26" }).clean).toBe("1234567");
    expect(normalizeLabel("1234567", { source: "bnp" }).clean).toBe("1234567");
  });

  it("keeps the raw label when cleaning empties it", () => {
    const raw = "PAIEMENT CB  - CARTE*0000";
    expect(normalizeLabel(raw, { source: "bnp" }).clean).toBe(raw);
    expect(normalizeLabel("PENDING", { source: "n26" }).clean).toBe("PENDING");
    expect(normalizeLabel("*", { source: "n26" }).clean).toBe("*");
  });
});

describe("deduplication hash is computed on the raw label", () => {
  const lines = [
    { date: "2026-10-11", description: "PAIEMENT CB EXEMPLE MARKET DU 11/10/26 A PARIS 12 - CARTE*0000", amount_cents: -1234 },
    { date: "2026-10-11", description: "PAIEMENT CB EXEMPLE MARKET DU 11/10/26 A PARIS 12 - CARTE*0000", amount_cents: -1234 },
  ];

  it("is unchanged by the normalisation, so already imported lines stay recognised", () => {
    const before = buildFileHashes(lines);
    // Cleaning the labels does not mutate the parsed lines the hash is built from.
    const cleaned = lines.map((line) => ({ ...line, clean: normalizeLabel(line.description, { source: "bnp" }).clean }));
    expect(cleaned[0]!.clean).toBe("Exemple Market");
    expect(buildFileHashes(cleaned)).toEqual(before);
    // Hashing the clean label instead would have changed it.
    const onClean = buildFileHashes(cleaned.map((l) => ({ ...l, description: l.clean })));
    expect(onClean).not.toEqual(before);
  });
});
