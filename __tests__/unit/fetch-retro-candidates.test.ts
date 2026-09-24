import { describe, expect, it, vi } from "vitest";

import { fetchRetroCandidates } from "@/lib/import/rule-retro-candidates";

const RULE = { id: "r1", keyword: "loyer", kind: "expense", priority: 0, share_space_id: "s", share_category_id: null, share_payer_percent: null };

function makeSupabase(rules: unknown[], rows: unknown[]) {
  const txCalls: Record<string, unknown[][]> = {};
  const record = (name: string, chain: unknown) =>
    vi.fn((...args: unknown[]) => {
      (txCalls[name] ??= []).push(args);
      return chain;
    });

  const rulesChain: Record<string, unknown> = {};
  rulesChain.select = vi.fn(() => rulesChain);
  rulesChain.eq = vi.fn(() => rulesChain);
  rulesChain.order = vi.fn(() => Promise.resolve({ data: rules, error: null }));

  const txChain: Record<string, unknown> = {};
  for (const name of ["select", "eq", "is", "lt", "gte", "order"]) txChain[name] = record(name, txChain);
  txChain.range = vi.fn(() => Promise.resolve({ data: rows, error: null }));

  const from = vi.fn((table: string) => (table === "csv_import_rules" ? rulesChain : txChain));
  return { supabase: { from } as unknown as Parameters<typeof fetchRetroCandidates>[0], txCalls };
}

describe("fetchRetroCandidates", () => {
  it("queries only live, non-transfer expenses of the space since the date, with a stable order", async () => {
    const { supabase, txCalls } = makeSupabase([RULE], []);
    await fetchRetroCandidates(supabase, "space-1", "r1", "2026-05-01");

    expect(txCalls.eq).toContainEqual(["space_id", "space-1"]);
    expect(txCalls.eq).toContainEqual(["kind", "expense"]);
    expect(txCalls.is).toContainEqual(["deleted_at", null]);
    expect(txCalls.is).toContainEqual(["transfer_id", null]);
    expect(txCalls.lt).toContainEqual(["amount_cents", 0]);
    expect(txCalls.gte).toContainEqual(["date", "2026-05-01"]);
    expect(txCalls.order).toContainEqual(["id"]);
  });

  it("returns the matching unshared lines, newest first", async () => {
    const rows = [
      { id: "old", date: "2026-01-01T00:00:00Z", description: "Loyer janvier", amount_cents: -85000, shared_expenses: null },
      { id: "new", date: "2026-04-01T00:00:00Z", description: "Loyer avril", amount_cents: -85000, shared_expenses: null },
      { id: "done", date: "2026-03-01T00:00:00Z", description: "Loyer mars", amount_cents: -85000, shared_expenses: { id: "se" } },
      { id: "other", date: "2026-02-01T00:00:00Z", description: "Courses", amount_cents: -4000, shared_expenses: null },
    ];
    const { supabase } = makeSupabase([RULE], rows);

    const out = await fetchRetroCandidates(supabase, "space-1", "r1", "2026-01-01");
    expect(out.map((c) => c.id)).toEqual(["new", "old"]);
  });
});
