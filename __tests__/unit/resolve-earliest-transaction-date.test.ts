import { describe, expect, it, vi } from "vitest";

import { resolveEarliestTransactionDate } from "@/lib/dates/resolve-earliest-transaction-date";

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.eq = vi.fn(self);
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
    const result = await resolveEarliestTransactionDate(supabase as never, "space-1");
    expect(result).toBe("2024-01-15");
  });

  it("returns null when there are no transactions", async () => {
    const supabase = makeSupabase(null);
    const result = await resolveEarliestTransactionDate(supabase as never, "space-1");
    expect(result).toBeNull();
  });

  it("scopes the query to accountIds when provided", async () => {
    const supabase = makeSupabase({ date: "2025-06-01" });
    const result = await resolveEarliestTransactionDate(supabase as never, "space-1", ["acc-1", "acc-2"]);
    expect(result).toBe("2025-06-01");
    const chain = supabase.from.mock.results[0]!.value as ReturnType<typeof makeChain>;
    expect(chain.eq).toHaveBeenCalledWith("space_id", "space-1");
    expect(chain.in).toHaveBeenCalledWith("account_id", ["acc-1", "acc-2"]);
  });

  it("short-circuits to null without querying when accountIds is empty", async () => {
    const supabase = makeSupabase({ date: "2024-01-01" });
    const result = await resolveEarliestTransactionDate(supabase as never, "space-1", []);
    expect(result).toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  describe("with shared expenses (shared space)", () => {
    /** One chain per table, so each query can answer differently. */
    function makeSupabaseByTable(byTable: Record<string, { date: string } | null>) {
      const chains: Record<string, ReturnType<typeof makeChain>> = {};
      const from = vi.fn((table: string) => (chains[table] ??= makeChain({ data: byTable[table] ?? null, error: null })));
      return { from, chains };
    }

    it("returns the shared expense date when it is earlier than any transaction", async () => {
      const supabase = makeSupabaseByTable({
        transactions: { date: "2026-09-10" },
        shared_expenses: { date: "2026-07-01T00:00:00+00:00" },
      });
      const result = await resolveEarliestTransactionDate(supabase as never, "space-1", ["acc-1"], {
        includeSharedExpenses: true,
      });
      expect(result).toBe("2026-07-01T00:00:00+00:00");
      expect(supabase.chains.shared_expenses!.eq).toHaveBeenCalledWith("space_id", "space-1");
    });

    it("keeps the transaction date when it is the earliest", async () => {
      const supabase = makeSupabaseByTable({
        transactions: { date: "2026-01-05" },
        shared_expenses: { date: "2026-07-01T00:00:00+00:00" },
      });
      const result = await resolveEarliestTransactionDate(supabase as never, "space-1", undefined, {
        includeSharedExpenses: true,
      });
      expect(result).toBe("2026-01-05");
    });

    it("still answers with the shared expense date when the space has no account at all", async () => {
      const supabase = makeSupabaseByTable({ shared_expenses: { date: "2026-07-01T00:00:00+00:00" } });
      const result = await resolveEarliestTransactionDate(supabase as never, "space-1", [], {
        includeSharedExpenses: true,
      });
      expect(result).toBe("2026-07-01T00:00:00+00:00");
      expect(supabase.from).not.toHaveBeenCalledWith("transactions");
    });

    it("never queries shared expenses unless asked (personal spaces are untouched)", async () => {
      const supabase = makeSupabaseByTable({ transactions: { date: "2026-01-05" } });
      await resolveEarliestTransactionDate(supabase as never, "space-1", ["acc-1"]);
      expect(supabase.from).not.toHaveBeenCalledWith("shared_expenses");
    });

    it("is null when there is nothing anywhere", async () => {
      const supabase = makeSupabaseByTable({});
      expect(
        await resolveEarliestTransactionDate(supabase as never, "space-1", ["acc-1"], { includeSharedExpenses: true }),
      ).toBeNull();
    });
  });
});
