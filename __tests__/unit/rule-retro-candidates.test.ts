import { describe, expect, it } from "vitest";

import { findMatchingRule } from "@/lib/import/apply-rules";
import { selectRetroCandidates, type RetroRule, type RetroTransactionRow } from "@/lib/import/rule-retro-candidates";

const rule = (over: Partial<RetroRule> & { id: string }): RetroRule => ({
  keyword: "loyer",
  kind: "expense",
  priority: 0,
  share_space_id: "shared-1",
  share_category_id: null,
  share_payer_percent: null,
  ...over,
});

const row = (over: Partial<RetroTransactionRow> & { id: string }): RetroTransactionRow => ({
  date: "2026-06-01T00:00:00Z",
  description: "Loyer juin",
  amount_cents: -80000,
  shared_expenses: null,
  ...over,
});

describe("findMatchingRule", () => {
  it("matches case-insensitively, by kind, first rule wins", () => {
    const rules = [
      rule({ id: "income", keyword: "loyer", kind: "income" }),
      rule({ id: "first", keyword: "LOYER" }),
      rule({ id: "second", keyword: "loyer juin" }),
    ];
    expect(findMatchingRule(rules, "Loyer Juin", "expense")?.id).toBe("first");
    expect(findMatchingRule(rules, "Loyer Juin", "income")?.id).toBe("income");
    expect(findMatchingRule(rules, "Courses", "expense")).toBeNull();
  });
});

describe("selectRetroCandidates", () => {
  const rules = [rule({ id: "target" })];

  it("keeps the unshared lines matched by the targeted rule", () => {
    const out = selectRetroCandidates(rules, "target", [row({ id: "a" }), row({ id: "b", description: "Courses" })]);
    expect(out.map((c) => c.id)).toEqual(["a"]);
    expect(out[0]).toEqual({ id: "a", date: "2026-06-01T00:00:00Z", description: "Loyer juin", amount_cents: -80000 });
  });

  it("excludes lines already shared, whether embedded as an object or an array", () => {
    const out = selectRetroCandidates(rules, "target", [
      row({ id: "obj", shared_expenses: { id: "se-1" } }),
      row({ id: "arr", shared_expenses: [{ id: "se-2" }] }),
      row({ id: "empty-arr", shared_expenses: [] }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["empty-arr"]);
  });

  it("respects priority: a line taken by a higher-priority rule is excluded", () => {
    const ordered = [
      rule({ id: "other", keyword: "loyer juin", share_space_id: null }),
      rule({ id: "target", keyword: "loyer", priority: 1 }),
    ];
    const out = selectRetroCandidates(ordered, "target", [
      row({ id: "taken", description: "Loyer juin" }),
      row({ id: "free", description: "Loyer juillet" }),
    ]);
    expect(out.map((c) => c.id)).toEqual(["free"]);
  });

  it("tolerates a null description", () => {
    expect(selectRetroCandidates(rules, "target", [row({ id: "n", description: null })])).toEqual([]);
  });
});
