import { describe, expect, it, vi } from "vitest";

import { buildRuleShareMatcher } from "@/lib/import/apply-rules";

type Rule = {
  keyword: string;
  kind: "expense" | "income";
  priority: number;
  share_space_id: string | null;
  share_category_id: string | null;
  share_payer_percent: number | null;
};

const rule = (over: Partial<Rule>): Rule => ({
  keyword: "netflix",
  kind: "expense",
  priority: 0,
  share_space_id: null,
  share_category_id: null,
  share_payer_percent: null,
  ...over,
});

function makeSupabase(rules: Rule[]) {
  const select = vi.fn();
  const chain: Record<string, unknown> = {};
  select.mockImplementation(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => Promise.resolve({ data: rules, error: null }));
  const from = vi.fn(() => ({ select }));
  return { supabase: { from } as unknown as Parameters<typeof buildRuleShareMatcher>[0], from, select, chain };
}

describe("buildRuleShareMatcher", () => {
  it("queries the rules of the space, by priority, with the share columns", async () => {
    const { supabase, from, select, chain } = makeSupabase([]);
    await buildRuleShareMatcher(supabase, "space-1");
    expect(from).toHaveBeenCalledWith("csv_import_rules");
    expect(select).toHaveBeenCalledWith(
      "keyword, kind, priority, share_space_id, share_category_id, share_payer_percent",
    );
    expect(chain.eq).toHaveBeenCalledWith("space_id", "space-1");
    expect(chain.order).toHaveBeenCalledWith("priority", { ascending: true });
  });

  it("returns null when no rule matches", async () => {
    const match = await buildRuleShareMatcher(makeSupabase([rule({ share_space_id: "s" })]).supabase, "space-1");
    expect(match("Lidl", "expense")).toBeNull();
  });

  it("returns the share of the matching rule (case-insensitive substring)", async () => {
    const rules = [rule({ share_space_id: "shared-1", share_category_id: "cat-1", share_payer_percent: 40 })];
    const match = await buildRuleShareMatcher(makeSupabase(rules).supabase, "space-1");
    expect(match("NETFLIX ABONNEMENT", "expense")).toEqual({
      space_id: "shared-1",
      category_id: "cat-1",
      payer_share_percent: 40,
    });
  });

  it("returns null category / percent when the rule has none", async () => {
    const match = await buildRuleShareMatcher(makeSupabase([rule({ share_space_id: "shared-1" })]).supabase, "space-1");
    expect(match("netflix", "expense")).toEqual({ space_id: "shared-1", category_id: null, payer_share_percent: null });
  });

  it("respects the kind filter", async () => {
    const rules = [rule({ keyword: "salaire", kind: "income", share_space_id: "shared-1" })];
    const match = await buildRuleShareMatcher(makeSupabase(rules).supabase, "space-1");
    expect(match("Virement salaire", "expense")).toBeNull();
    expect(match("Virement salaire", "income")).not.toBeNull();
  });

  it("first match wins: a matching rule WITHOUT share stops the search", async () => {
    const rules = [
      rule({ keyword: "netflix", priority: 0 }),
      rule({ keyword: "net", priority: 1, share_space_id: "shared-1" }),
    ];
    const match = await buildRuleShareMatcher(makeSupabase(rules).supabase, "space-1");
    expect(match("Netflix", "expense")).toBeNull();
  });

  it("first match wins: an earlier sharing rule beats a later one", async () => {
    const rules = [
      rule({ keyword: "net", priority: 0, share_space_id: "shared-1" }),
      rule({ keyword: "netflix", priority: 1, share_space_id: "shared-2" }),
    ];
    const match = await buildRuleShareMatcher(makeSupabase(rules).supabase, "space-1");
    expect(match("Netflix", "expense")?.space_id).toBe("shared-1");
  });

  it("copes with a null result", async () => {
    const supabase = {
      from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: null, error: null }) }) }) }),
    } as unknown as Parameters<typeof buildRuleShareMatcher>[0];
    const match = await buildRuleShareMatcher(supabase, "space-1");
    expect(match("x", "expense")).toBeNull();
  });
});
