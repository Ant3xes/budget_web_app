import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })) }));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));

import { withSpace } from "@/lib/spaces/with-space";
import { PATCH } from "@/app/api/transactions/[id]/route";

const TX = "44444444-4444-4444-8444-444444444444";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const CAT = "33333333-3333-4333-8333-333333333333";

function setup(existing: Record<string, unknown> | null, opts: { accounts?: { id: string }[]; category?: unknown; rpcError?: string } = {}) {
  const rpc = vi.fn(() => Promise.resolve({ error: opts.rpcError ? { message: opts.rpcError } : null }));
  const update = vi.fn();
  const from = vi.fn((table: string) => {
    const result =
      table === "accounts" ? { data: opts.accounts ?? [{ id: A }, { id: B }], error: null } : { data: null, error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "in"]) chain[m] = vi.fn(() => chain);
    chain.update = vi.fn((...args: unknown[]) => { update(...args); return chain; });
    chain.single = vi.fn(() => Promise.resolve({ data: existing, error: null }));
    chain.maybeSingle = vi.fn(() => Promise.resolve({ data: "category" in opts ? opts.category : { id: CAT }, error: null }));
    chain.then = (res: (v: unknown) => unknown) => Promise.resolve(result).then(res);
    return chain;
  });
  vi.mocked(withSpace).mockResolvedValue({ supabase: { from, rpc }, user: { id: "u" }, spaceId: "space-1", space: {}, spaces: [] } as never);
  return { rpc, update };
}

const call = (body: unknown) =>
  PATCH(new Request("http://localhost", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: TX }) });

const expenseRow = { kind: "expense", transfer_id: null, account_id: A, amount_cents: -1000, date: "2026-10-01T00:00:00Z", description: "Synthetic", notes: null, category_id: CAT };
const debitRow = { ...expenseRow, kind: "transfer_debit", transfer_id: "55555555-5555-4555-8555-555555555555", category_id: null };

describe("PATCH /api/transactions/[id] type conversion", () => {
  beforeEach(() => vi.clearAllMocks());

  it("expense -> transfer calls the atomic function with a credit mirror", async () => {
    const { rpc } = setup(expenseRow);
    const res = await call({ kind: "transfer", from_account_id: A, to_account_id: B, amount_cents: 1000 });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("convert_transaction", expect.objectContaining({
      p_id: TX, p_space_id: "space-1", p_kind: "transfer_debit", p_account_id: A, p_amount_cents: -1000,
      p_category_id: null, p_mirror_kind: "transfer_credit", p_mirror_account_id: B, p_mirror_amount_cents: 1000,
    }));
  });

  it("transfer -> income without category is refused and nothing is written", async () => {
    const { rpc } = setup(debitRow);
    const res = await call({ kind: "income", account_id: A, amount_cents: 1000 });
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("transfer -> expense with a category drops the mirror", async () => {
    const { rpc } = setup(debitRow);
    const res = await call({ kind: "expense", account_id: A, amount_cents: 1000, category_id: CAT });
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("convert_transaction", expect.objectContaining({ p_kind: "expense", p_amount_cents: -1000, p_category_id: CAT, p_mirror_kind: null }));
  });

  it("expense -> income flips the sign", async () => {
    const { rpc } = setup(expenseRow);
    await call({ kind: "income", account_id: A, amount_cents: 1000, category_id: CAT });
    expect(rpc).toHaveBeenCalledWith("convert_transaction", expect.objectContaining({ p_kind: "income", p_amount_cents: 1000 }));
  });

  it("refuses an account outside the space (404)", async () => {
    const { rpc } = setup(expenseRow, { accounts: [{ id: A }] });
    const res = await call({ kind: "transfer", from_account_id: A, to_account_id: B, amount_cents: 1000 });
    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a category outside the space or of the wrong kind (404)", async () => {
    const { rpc } = setup(expenseRow, { category: null });
    const res = await call({ kind: "income", account_id: A, amount_cents: 1000, category_id: CAT });
    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces an SQL error", async () => {
    setup(expenseRow, { rpcError: "boom" });
    const res = await call({ kind: "income", account_id: A, amount_cents: 1000, category_id: CAT });
    expect(res.status).toBe(400);
  });

  it("without a kind, a transfer line is still refused", async () => {
    setup(debitRow);
    const res = await call({ description: "x" });
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown transaction", async () => {
    setup(null);
    expect((await call({ kind: "income", account_id: A, amount_cents: 1 })).status).toBe(404);
  });
});
