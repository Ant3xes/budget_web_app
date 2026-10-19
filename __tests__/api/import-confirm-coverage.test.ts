import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChainableMock } from "@/__tests__/mocks/supabase";
import { POST } from "@/app/api/import/confirm/route";
import { withSpace } from "@/lib/spaces/with-space";
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
const account = "00000000-0000-4000-8000-000000000001";
const shared = "00000000-0000-4000-8000-000000000002";
const expense = { hash: "synthetic", date: "2026-01-01", description: "Synthetic", kind: "expense", amount_cents: -100 };
const request = (body: unknown) => new Request("http://test/api/import/confirm", { method: "POST", body: JSON.stringify(body) });
function setup(results: Record<string, { data: unknown; error: unknown }> = {}, inserted: unknown = 1) {
  const defaults = { accounts: { data: [{ id: account }], error: null }, space_members: { data: [{ user_id: "user" }, { user_id: "other" }], error: null }, spaces: { data: { default_share_percent: 60 }, error: null }, ...results };
  const chains = Object.fromEntries(Object.entries(defaults).map(([table, result]) => [table, createChainableMock(result)]));
  const rpc = vi.fn().mockResolvedValue({ data: inserted, error: null });
  const from = vi.fn((table: string) => chains[table]);
  vi.mocked(withSpace).mockResolvedValue({ user: { id: "user" }, spaceId: "personal", space: { kind: "personal" }, spaces: [{ id: "personal", kind: "personal" }, { id: shared, kind: "shared" }], supabase: { from, rpc } } as never);
  return { chains, rpc, from };
}
beforeEach(() => vi.resetAllMocks());
describe("import confirm failure boundaries", () => {
  it.each([null, { account_id: account, transactions: [{ ...expense, description: "" }] }])("returns a useful validation error for %j", async body => {
    const { from, rpc } = setup();
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toEqual(expect.any(String));
    if (body !== null) expect(json.error).toMatch(/^transactions.0.description:/);
    else expect(json.error).not.toMatch(/^:/);
    expect(from).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("reports account lookup failures without importing", async () => {
    const { rpc } = setup({ accounts: { data: null, error: { message: "Accounts denied" } } });
    const response = await POST(request({ account_id: account, transactions: [expense] }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Request failed" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("treats null account data as an unknown target account", async () => {
    const { rpc } = setup({ accounts: { data: null, error: null } });
    const response = await POST(request({ account_id: account, transactions: [expense] }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Compte introuvable" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it.each(["space_members", "spaces"])("maps %s lookup errors and imports nothing", async table => {
    const { rpc } = setup({ [table]: { data: null, error: { code: "42501", message: "Forbidden target" } } });
    const response = await POST(request({ account_id: account, transactions: [{ ...expense, share: { space_id: shared } }] }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden target" });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("uses a 50 percent split when the shared space has no default", async () => {
    const { rpc } = setup({ spaces: { data: null, error: null } });
    const response = await POST(request({ account_id: account, transactions: [{ ...expense, raw_label: "  RAW SYNTHETIC  ", share: { space_id: shared } }] }));
    expect(await response.json()).toEqual({ ok: true, imported: 1, skipped: 0, shared: 1 });
    const args = rpc.mock.calls[0]![1];
    expect(args.p_shares[0].shares).toEqual({ user: 50, other: 50 });
    expect(args.p_rows[0].raw_import_data).toEqual({ hash: "synthetic", raw_label: "RAW SYNTHETIC" });
    expect(args.p_shares[0].source_transaction_id).toBe(args.p_rows[0].id);
  });
  it("does not import when the members result is null", async () => {
    const { rpc } = setup({ space_members: { data: null, error: null } });
    const response = await POST(request({ account_id: account, transactions: [{ ...expense, share: { space_id: shared } }] }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "The payer must be a member of the space." });
    expect(rpc).not.toHaveBeenCalled();
  });
  it("falls back to the input count for a nonnumeric RPC result", async () => {
    const { rpc } = setup({}, null);
    const response = await POST(request({ account_id: account, transactions: [expense, { ...expense, hash: "second" }] }));
    expect(await response.json()).toEqual({ ok: true, imported: 2, skipped: 0, shared: 0 });
    expect(rpc).toHaveBeenCalledWith("import_transactions", { p_rows: expect.any(Array), p_shares: [] });
    expect(rpc.mock.calls[0]![1].p_rows).toHaveLength(2);
  });
});
