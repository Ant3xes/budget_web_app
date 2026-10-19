import { must } from "@/__tests__/helpers/must";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchReimbursementIndex } from "@/lib/transactions/fetch-reimbursements";
import { buildReimbursementIndex, netAmounts } from "@/lib/transactions/net-amount";
import { fetchTransferCounterparts } from "@/lib/transactions/transfer-counterparts";

function clientReturning(data: unknown, error: { message: string } | null = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "eq", "is", "in", "not", "order", "range"]) chain[m] = vi.fn(() => chain);
  chain.then = vi.fn((ok, ko) => Promise.resolve({ data, error }).then(ok, ko));
  const from = vi.fn(() => chain);
  return { supabase: { from } as unknown as SupabaseClient, chain, from };
}

describe("fetchTransferCounterparts", () => {
  it("returns an empty map without querying when there is no transfer", async () => {
    const { supabase, from } = clientReturning([]);
    expect(await fetchTransferCounterparts(supabase, "space-1", [])).toEqual({});
    expect(from).not.toHaveBeenCalled();
  });

  it("scopes the query to credit sides of the space and maps object, array and missing embeds", async () => {
    const { supabase, chain } = clientReturning([
      { transfer_id: "t1", account_id: "acc-1", accounts: { name: "Synthetic checking" } },
      { transfer_id: "t2", account_id: "acc-2", accounts: [{ name: "Synthetic savings" }] },
      { transfer_id: "t3", account_id: "acc-3", accounts: [] },
      { transfer_id: "t4", account_id: "acc-4", accounts: null },
    ]);
    const result = await fetchTransferCounterparts(supabase, "space-1", ["t1", "t2", "t3", "t4"]);
    expect(result).toEqual({
      t1: { id: "acc-1", name: "Synthetic checking" },
      t2: { id: "acc-2", name: "Synthetic savings" },
      t3: null,
      t4: null,
    });
    expect(must(chain.eq).mock.calls).toEqual([["space_id", "space-1"], ["kind", "transfer_credit"]]);
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(chain.in).toHaveBeenCalledWith("transfer_id", ["t1", "t2", "t3", "t4"]);
  });

  it("returns an empty map when the query yields no data", async () => {
    const { supabase } = clientReturning(null);
    expect(await fetchTransferCounterparts(supabase, "space-1", ["t1"])).toEqual({});
  });
});

describe("fetchReimbursementIndex", () => {
  it("indexes active links of the space and ignores rows without a target", async () => {
    const { supabase, chain } = clientReturning([
      { id: "r1", amount_cents: "2500", reimburses_transaction_id: "gift" },
      { id: "r2", amount_cents: 3500, reimburses_transaction_id: "gift" },
      { id: "orphan", amount_cents: 900, reimburses_transaction_id: null },
    ]);
    const index = await fetchReimbursementIndex(supabase, "space-1");
    expect(index.byExpense.get("gift")).toBe(6000);
    expect([...index.linkedSourceIds].sort()).toEqual(["r1", "r2"]);
    expect(chain.eq).toHaveBeenCalledWith("space_id", "space-1");
    expect(chain.not).toHaveBeenCalledWith("reimburses_transaction_id", "is", null);
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("propagates read errors", async () => {
    const { supabase } = clientReturning(null, { message: "Synthetic failure" });
    await expect(fetchReimbursementIndex(supabase, "space-1")).rejects.toThrow("Synthetic failure");
  });
});

describe("net-amount edge cases", () => {
  it("ignores non-positive links", () => {
    const index = buildReimbursementIndex([
      { id: "zero", expenseId: "gift", amount_cents: 0 },
      { id: "negative", expenseId: "gift", amount_cents: -200 },
    ]);
    expect(index.byExpense.size).toBe(0);
    expect(index.linkedSourceIds.size).toBe(0);
  });

  it("nets a positive (shared activity) expense keeping its positive sign", () => {
    const index = buildReimbursementIndex([{ id: "r1", expenseId: "shared", amount_cents: 2000 }]);
    expect(netAmounts([{ id: "shared", amount_cents: 9000 }], index)).toEqual([{ id: "shared", amount_cents: 7000 }]);
  });
});
