import { describe, expect, it } from "vitest";

import { labelFields } from "@/lib/import/label-fields";
import { resolveSuggestion, type SpaceCategory, type SuggestionMatchers } from "@/lib/import/resolve-suggestion";

const categories: SpaceCategory[] = [
  { id: "c-super", name: "Supermarché", kind: "expense", translation_key: "supermarche" },
  { id: "c-custom", name: "Courses perso", kind: "expense", translation_key: null },
  { id: "c-food", name: "Alimentation", kind: "expense", translation_key: "alimentation" },
];

const none = () => null;
const matchers = (over: Partial<SuggestionMatchers> = {}): SuggestionMatchers => ({
  rule: none,
  history: none,
  default: none,
  ...over,
});

describe("resolveSuggestion — priority (issue 130)", () => {
  const label = "CARTE CARREFOUR MARKET PARIS";

  it("merchant database alone resolves the space category by translation_key", () => {
    expect(resolveSuggestion(label, "expense", matchers(), categories)).toMatchObject({
      category_id: "c-super",
      source: "merchant",
    });
  });

  it("a personal rule beats the merchant database", () => {
    const r = resolveSuggestion(label, "expense", matchers({ rule: () => "c-custom" }), categories);
    expect(r).toMatchObject({ category_id: "c-custom", source: "rule" });
  });

  it("history beats merchants and defaults, but not rules", () => {
    const m = matchers({ history: () => "c-food", default: () => "c-food" });
    expect(resolveSuggestion(label, "expense", m, categories).source).toBe("history");
    expect(resolveSuggestion(label, "expense", { ...m, rule: () => "c-custom" }, categories).source).toBe("rule");
  });

  it("merchants beat default keywords", () => {
    const r = resolveSuggestion(label, "expense", matchers({ default: () => "c-food" }), categories);
    expect(r).toMatchObject({ category_id: "c-super", source: "merchant" });
  });

  it("falls back to default keywords for an unknown merchant", () => {
    const r = resolveSuggestion("LIBELLE INCONNU XYZ", "expense", matchers({ default: () => "c-food" }), categories);
    expect(r).toMatchObject({ category_id: "c-food", source: "default", merchant: null });
  });

  it("no suggestion at all gives null", () => {
    expect(resolveSuggestion("LIBELLE INCONNU XYZ", "expense", matchers(), categories)).toMatchObject({
      category_id: null,
      source: null,
    });
  });

  it("category absent from the space: no merchant suggestion (default keywords still apply)", () => {
    const withoutSuper = categories.filter((c) => c.id !== "c-super");
    expect(resolveSuggestion(label, "expense", matchers(), withoutSuper)).toMatchObject({
      category_id: null,
      source: null,
    });
    expect(resolveSuggestion(label, "expense", matchers({ default: () => "c-food" }), withoutSuper).source).toBe(
      "default",
    );
  });

  it("ignores a merchant whose kind differs from the line kind", () => {
    expect(resolveSuggestion(label, "income", matchers(), categories).category_id).toBeNull();
  });
});

describe("labelFields (issue 130)", () => {
  it("sends the clean label as description and the bank label as raw_label", () => {
    expect(labelFields({ description: "PAIEMENT CB EXEMPLE 12/03", clean_description: "Exemple" })).toEqual({
      description: "Exemple",
      raw_label: "PAIEMENT CB EXEMPLE 12/03",
    });
  });

  it("falls back to the raw label when no clean one is provided", () => {
    expect(labelFields({ description: "RAW" })).toEqual({ description: "RAW", raw_label: "RAW" });
  });
});
