import { describe, expect, it, vi } from "vitest";

import { buildRuleMatcher } from "@/lib/import/apply-rules";

type Rule = { keyword: string; category_id: string; kind: "expense" | "income"; priority: number };

function makeSupabase(rules: Rule[]) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.order = () => Promise.resolve({ data: rules, error: null });
  return {
    from: () => chain,
  } as unknown as Parameters<typeof buildRuleMatcher>[0];
}

describe("buildRuleMatcher", () => {
  it("returns null when no rules match", async () => {
    const match = await buildRuleMatcher(makeSupabase([]), "user-1");
    expect(match("Netflix", "expense")).toBeNull();
  });

  it("matches by substring (case-insensitive)", async () => {
    const rules: Rule[] = [
      { keyword: "netflix", category_id: "cat-streaming", kind: "expense", priority: 0 },
    ];
    const match = await buildRuleMatcher(makeSupabase(rules), "user-1");
    expect(match("NETFLIX ABONNEMENT", "expense")).toBe("cat-streaming");
    expect(match("netflix subscription", "expense")).toBe("cat-streaming");
  });

  it("respects the kind filter", async () => {
    const rules: Rule[] = [
      { keyword: "salaire", category_id: "cat-salary", kind: "income", priority: 0 },
    ];
    const match = await buildRuleMatcher(makeSupabase(rules), "user-1");
    expect(match("Virement salaire", "income")).toBe("cat-salary");
    expect(match("Virement salaire", "expense")).toBeNull();
  });

  it("returns first match by priority order", async () => {
    const rules: Rule[] = [
      { keyword: "lidl", category_id: "cat-grocery", kind: "expense", priority: 0 },
      { keyword: "lidl supermarche", category_id: "cat-food", kind: "expense", priority: 1 },
    ];
    const match = await buildRuleMatcher(makeSupabase(rules), "user-1");
    // priority 0 wins
    expect(match("LIDL SUPERMARCHE 01", "expense")).toBe("cat-grocery");
  });

  it("returns null when kind does not match", async () => {
    const rules: Rule[] = [
      { keyword: "amazon", category_id: "cat-shopping", kind: "income", priority: 0 },
    ];
    const match = await buildRuleMatcher(makeSupabase(rules), "user-1");
    expect(match("AMAZON EU", "expense")).toBeNull();
  });

  it("handles multiple rules with different keywords", async () => {
    const rules: Rule[] = [
      { keyword: "netflix", category_id: "cat-streaming", kind: "expense", priority: 0 },
      { keyword: "lidl", category_id: "cat-grocery", kind: "expense", priority: 1 },
      { keyword: "salaire", category_id: "cat-salary", kind: "income", priority: 0 },
    ];
    const match = await buildRuleMatcher(makeSupabase(rules), "user-1");
    expect(match("NETFLIX", "expense")).toBe("cat-streaming");
    expect(match("LIDL PARIS", "expense")).toBe("cat-grocery");
    expect(match("VIREMENT SALAIRE", "income")).toBe("cat-salary");
    expect(match("RANDOM SHOP", "expense")).toBeNull();
  });
});
