import { describe, expect, it } from "vitest";
import { matchMerchant, merchants, normalizeForMatch } from "@/lib/import/merchants";

// The 30 default categories (17 original + 13 added by issue 15).
const CATEGORY_KEYS = [
  "alimentation", "logement", "transport", "sante", "loisirs", "vetements", "restaurants", "voyages",
  "abonnements", "education", "cadeaux", "banque_frais", "salaire", "freelance", "remboursement",
  "autre_revenu", "virement_interne",
  "supermarche", "commerces_proximite", "transports_en_commun", "taxi_vtc", "carburant", "stationnement",
  "velo_trottinette", "sport", "sorties_concerts", "shopping", "outils_pro", "impots_amendes", "dons",
];

describe("data/merchants.json", () => {
  it("has the 30 default category keys", () => {
    expect(new Set(CATEGORY_KEYS).size).toBe(30);
  });

  it("holds at least 180 entries", () => {
    expect(merchants.length).toBeGreaterThanOrEqual(180);
  });

  it("follows the schema", () => {
    for (const m of merchants) {
      expect(typeof m.name).toBe("string");
      expect(m.name.trim()).not.toBe("");
      expect(Array.isArray(m.patterns)).toBe(true);
      expect(m.patterns.length).toBeGreaterThan(0);
      for (const p of m.patterns) expect(p.trim().length).toBeGreaterThanOrEqual(2);
      expect(CATEGORY_KEYS, `${m.name}: unknown category_key ${m.category_key}`).toContain(m.category_key);
      expect(["expense", "income"]).toContain(m.kind);
      expect(Object.keys(m).sort()).toEqual(["category_key", "kind", "name", "patterns"]);
    }
  });

  it("has no duplicated pattern or name", () => {
    const patterns = merchants.flatMap((m) => m.patterns.map(normalizeForMatch));
    expect(patterns.filter((p, i) => patterns.indexOf(p) !== i)).toEqual([]);
    const names = merchants.map((m) => m.name.toLowerCase());
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it("contains no personal data (IBAN, e-mail, long digit runs, SumUp personal labels)", () => {
    for (const text of merchants.flatMap((m) => [m.name, ...m.patterns])) {
      expect(text).not.toMatch(/\b[A-Z]{2}\d{2}[ ]?[A-Z0-9]{4}/); // IBAN-like
      expect(text).not.toMatch(/@/);
      expect(text).not.toMatch(/\d{6,}/);
      expect(text).not.toMatch(/sumup|moneybeam|wero|virement|\bvers\b/i);
    }
  });
});

describe("matchMerchant", () => {
  it.each([
    ["BIGEM INTERMARC", "supermarche"],
    ["BIGEM INTERMARCHE", "supermarche"],
    ["UBR* PENDING.UB (PAYS-BAS)", "taxi_vtc"],
    ["UBER   * EATS PENDING", "restaurants"],
    ["UBR* EATS PENDING", "restaurants"],
    ["UBER   *ONE MEMBERSHIP", "abonnements"],
    ["Amazon Prime*4043P4XI5", "abonnements"],
    ["AMZN Mktp FR*3S8GB7X85", "shopping"],
    ["AMAZON PAYMENTS", "shopping"],
    ["SPOTIFY (SUEDE)", "abonnements"],
    ["SPOTIFYFR (SUEDE)", "abonnements"],
    ["SERVICE NAVIGO", "transports_en_commun"],
    ["NAVIGO", "transports_en_commun"],
    ["CARREFOURMARKET", "supermarche"],
    ["CARREFOUR CITY", "supermarche"],
    ["GOOGLE *ADS7964900656", "outils_pro"],
    ["GOOGLE*GOOGLE ONE", "outils_pro"],
    ["FACEBK *97CVUJRM22", "outils_pro"],
    ["CURSOR, AI POWERED IDE", "outils_pro"],
    ["ANTHROPIC* CLAUDE SUB", "outils_pro"],
    ["OPENAI *CHATGPT SUBSCR", "outils_pro"],
    ["infomaniak.com", "outils_pro"],
    ["STATION TOTAL (FRANCE)", "carburant"],
    ["ESSO MEUDONLAFOR", "carburant"],
    ["LIME*TRAJET G3EK", "velo_trottinette"],
    ["EasyPark SARL", "stationnement"],
    ["YESPARK GROUP*", "stationnement"],
    ["SHOTGUN* MMCLUB", "sorties_concerts"],
    ["DRFIP ILLE ET VILAINE", "impots_amendes"],
    ["YVELINES AMENDES", "impots_amendes"],
    ["FRAIS TENUE DE COMPTE", "banque_frais"],
    ["PRELEVEMENT AXA DU 09/10/26 - EMETTEUR : FR75ZZZ418185 MDT - MOTIF : P", "sante"],
    ["HOTEL AT BOOKIN (PAYS-BAS)", "voyages"],
    ["BOLT", "taxi_vtc"],
    ["Uniqlo Le Marais", "shopping"],
    ["LEROY MERLIN", "logement"],
    ["UCPA", "sport"],
  ])("%s -> %s", (label, category) => {
    expect(matchMerchant(label)?.category_key).toBe(category);
  });

  it("is case and accent insensitive", () => {
    expect(matchMerchant("monoprix")?.name).toBe(matchMerchant("MONOPRIX")?.name);
    expect(matchMerchant("MONOPRIX")).not.toBeNull();
  });

  it("returns the match shape", () => {
    expect(matchMerchant("UBER   * EATS PENDING")).toEqual({
      name: "Uber Eats",
      category_key: "restaurants",
      kind: "expense",
    });
  });

  it("does not match inside a longer word", () => {
    expect(matchMerchant("BPIFRANCE FINANCEMENT")).toBeNull();
  });

  it("leaves unknown labels and person-to-person payments uncategorised", () => {
    expect(matchMerchant("")).toBeNull();
    expect(matchMerchant("XYZ UNKNOWN SHOP")).toBeNull();
    expect(matchMerchant("SumUp  *Quelqu Un")).toBeNull();
    expect(matchMerchant("VIREMENT SEPA VERS DUPONT")).toBeNull();
    expect(matchMerchant("MONEYBEAM")).toBeNull();
  });
});
