import { describe, expect, it, vi } from "vitest";

import { resolveEarliestTransactionDate } from "@/lib/dates/resolve-earliest-transaction-date";

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.is = vi.fn(self);
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  return chain;
}

function makeSupabase(data: { date: string } | null) {
  const chain = makeChain({ data, error: null });
  return { from: vi.fn(() => chain), __chain: chain } as unknown as ReturnType<
    typeof makeChain
  > & { from: ReturnType<typeof vi.fn> };
}

describe("resolveEarliestTransactionDate", () => {
  it("returns the earliest date when unscoped (no accountIds)", async () => {
    const supabase = makeSupabase({ date: "2024-01-15" });
    const result = await resolveEarliestTransactionDate(supabase as never);
    expect(result).toBe("2024-01-15");
  });

  it("returns null when there are no transactions", async () => {
    const supabase = makeSupabase(null);
    const result = await resolveEarliestTransactionDate(supabase as never);
    expect(result).toBeNull();
  });

  it("scopes the query to accountIds when provided", async () => {
    const supabase = makeSupabase({ date: "2025-06-01" });
    const result = await resolveEarliestTransactionDate(supabase as never, ["acc-1", "acc-2"]);
    expect(result).toBe("2025-06-01");
    const chain = supabase.from.mock.results[0]!.value as ReturnType<typeof makeChain>;
    expect(chain.in).toHaveBeenCalledWith("account_id", ["acc-1", "acc-2"]);
  });

  it("short-circuits to null without querying when accountIds is empty", async () => {
    const supabase = makeSupabase({ date: "2024-01-01" });
    const result = await resolveEarliestTransactionDate(supabase as never, []);
    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
