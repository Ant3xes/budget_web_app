import { describe, expect, it, vi } from "vitest";

import { buildDefaultMatcher, buildHistoryMatcher, buildRuleMatcher, detectTransfer } from "@/lib/import/apply-rules";

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

// ---------------------------------------------------------------------------
// detectTransfer
// ---------------------------------------------------------------------------

describe("detectTransfer", () => {
  it("matches 'virement' at start", () => {
    expect(detectTransfer("Virement SEPA vers compte épargne")).toBe(true);
  });

  it("matches 'virement' standalone (exact)", () => {
    expect(detectTransfer("virement")).toBe(true);
  });

  it("matches 'vir sepa' (prefix)", () => {
    expect(detectTransfer("VIR SEPA ROMAIN PEREIRA")).toBe(true);
  });

  it("matches 'vir inst' (prefix)", () => {
    expect(detectTransfer("VIR INST BANQUE EN LIGNE")).toBe(true);
  });

  it("matches 'transfer' mid-string after space", () => {
    expect(detectTransfer("INTERNATIONAL transfer ref 123")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(detectTransfer("VIREMENT MENSUEL")).toBe(true);
  });

  it("returns false for regular expense descriptions", () => {
    expect(detectTransfer("AMAZON EU SARL")).toBe(false);
    expect(detectTransfer("CARREFOUR PARIS")).toBe(false);
    expect(detectTransfer("NETFLIX.COM")).toBe(false);
  });

  it("returns false for partial match not at word boundary", () => {
    // 'virement' must be at start OR preceded by a space; 'xvirement' must NOT match
    expect(detectTransfer("xvirement")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildDefaultMatcher
// ---------------------------------------------------------------------------

describe("buildDefaultMatcher", () => {
  const categories = [
    { id: "cat-alimentation", name: "Alimentation", kind: "expense" as const },
    { id: "cat-transport", name: "Transport", kind: "expense" as const },
    { id: "cat-streaming", name: "Abonnements streaming", kind: "expense" as const },
    { id: "cat-salaire", name: "Salaire", kind: "income" as const },
  ];

  it("returns null when no categories are provided", () => {
    const match = buildDefaultMatcher([]);
    expect(match("Lidl supermarché", "expense")).toBeNull();
  });

  it("matches a known grocery store to alimentation category", () => {
    const match = buildDefaultMatcher(categories);
    expect(match("LIDL PARIS 75001", "expense")).toBe("cat-alimentation");
  });

  it("matches transport keyword", () => {
    const match = buildDefaultMatcher(categories);
    expect(match("SNCF BILLET TGV", "expense")).toBe("cat-transport");
  });

  it("returns null when kind does not match", () => {
    // salaire is income, not expense
    const match = buildDefaultMatcher(categories);
    expect(match("salaire janvier", "expense")).toBeNull();
  });

  it("matches salary keyword for income kind", () => {
    const match = buildDefaultMatcher(categories);
    expect(match("Virement salaire janvier", "income")).toBe("cat-salaire");
  });

  it("returns null for unknown description", () => {
    const match = buildDefaultMatcher(categories);
    expect(match("DEPOT ESPECES", "expense")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildHistoryMatcher
// ---------------------------------------------------------------------------

describe("buildHistoryMatcher", () => {
  function makeHistorySupabase(rows: { description: string; kind: string; category_id: string }[]) {
    const chain: Record<string, unknown> = {};
    chain.select = () => chain;
    chain.eq = () => chain;
    chain.not = () => chain;
    chain.is = () => Promise.resolve({ data: rows, error: null });
    return { from: () => chain } as unknown as Parameters<typeof buildHistoryMatcher>[0];
  }

  it("returns null when no history exists", async () => {
    const match = await buildHistoryMatcher(makeHistorySupabase([]), "user-1");
    expect(match("Netflix", "expense")).toBeNull();
  });

  it("returns the most frequent category for a known description", async () => {
    const rows = [
      { description: "Netflix", kind: "expense", category_id: "cat-streaming" },
      { description: "Netflix", kind: "expense", category_id: "cat-streaming" },
      { description: "Netflix", kind: "expense", category_id: "cat-other" },
    ];
    const match = await buildHistoryMatcher(makeHistorySupabase(rows), "user-1");
    expect(match("Netflix", "expense")).toBe("cat-streaming");
  });

  it("is case-insensitive on description", async () => {
    const rows = [
      { description: "NETFLIX", kind: "expense", category_id: "cat-streaming" },
    ];
    const match = await buildHistoryMatcher(makeHistorySupabase(rows), "user-1");
    expect(match("netflix", "expense")).toBe("cat-streaming");
    expect(match("Netflix", "expense")).toBe("cat-streaming");
  });

  it("does not match wrong kind", async () => {
    const rows = [
      { description: "Remboursement", kind: "income", category_id: "cat-remb" },
    ];
    const match = await buildHistoryMatcher(makeHistorySupabase(rows), "user-1");
    expect(match("Remboursement", "expense")).toBeNull();
    expect(match("Remboursement", "income")).toBe("cat-remb");
  });
});
