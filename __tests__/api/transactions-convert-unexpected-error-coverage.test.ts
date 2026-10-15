import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
vi.mock("@/lib/transactions/convert-transaction", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/transactions/convert-transaction")>()),
  planConversion: vi.fn(() => {
    throw new TypeError("Synthetic planner bug");
  }),
}));

import { withSpace } from "@/lib/spaces/with-space";
import { PATCH } from "@/app/api/transactions/[id]/route";

const TX = "44444444-4444-4444-8444-444444444444";

describe("PATCH /api/transactions/[id] unexpected planner failure", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rethrows errors that are not ConversionError instead of masking them as 400", async () => {
    const rpc = vi.fn();
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is"]) chain[m] = vi.fn(() => chain);
    chain.single = vi.fn(() =>
      Promise.resolve({
        data: { kind: "expense", transfer_id: null, account_id: "a", amount_cents: -100, date: "2026-10-01", description: "x", notes: null, category_id: null },
      }),
    );
    vi.mocked(withSpace).mockResolvedValue({ supabase: { from: vi.fn(() => chain), rpc }, user: { id: "u" }, spaceId: "s", space: {}, spaces: [] } as never);

    const request = new Request("http://localhost", { method: "PATCH", body: JSON.stringify({ kind: "income" }) });
    await expect(PATCH(request, { params: Promise.resolve({ id: TX }) })).rejects.toThrow("Synthetic planner bug");
    expect(rpc).not.toHaveBeenCalled();
  });
});
