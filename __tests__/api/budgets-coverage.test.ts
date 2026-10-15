import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChainableMock } from "@/__tests__/mocks/supabase";
import { GET, POST } from "@/app/api/budgets/route";
import { withSpace } from "@/lib/spaces/with-space";
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
const category = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const payload = { category_id: category, month: "2026-12", amount_cents: 10000 };
const request = (body: unknown) => new Request("http://test/api/budgets", { method: "POST", body: JSON.stringify(body) });
function setup(results: Record<string, { data: unknown; error: unknown }> = {}, shared = false) {
  const chains = Object.fromEntries(Object.entries(results).map(([key, result]) => [key, createChainableMock(result)]));
  const from = vi.fn((table: string) => chains[table] ?? createChainableMock());
  // Reimbursement index query (paged): a 60.00 refund linked to the "expense" row.
  if (chains.transactions) Object.assign(chains.transactions, { range: vi.fn(() => Promise.resolve({ data: [{ id: "refund", amount_cents: 6000, reimburses_transaction_id: "expense" }], error: null })) });
  vi.mocked(withSpace).mockResolvedValue({ user: { id: "user" }, spaceId: "space", space: { kind: shared ? "shared" : "personal" }, supabase: { from } } as never);
  return { from, chains };
}
beforeEach(() => vi.resetAllMocks());
describe("budget boundaries and net consumption", () => {
  it("requires authentication on both endpoints", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);
    for (const response of [await GET(new Request("http://test")), await POST(request(payload))]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
  });
  it("rejects a malformed month before querying", async () => {
    const { from } = setup();
    expect((await GET(new Request("http://test?month=bad"))).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it("lists all months without fetching consumption and normalizes a null list", async () => {
    const { from, chains } = setup({ budgets: { data: null, error: null } }, true);
    expect(await (await GET(new Request("http://test"))).json()).toEqual({ budgets: [], consumption: {} });
    expect(from).toHaveBeenCalledTimes(1);
    expect(chains.budgets.gte).not.toHaveBeenCalled();
  });
  it("returns budget query errors", async () => {
    setup({ budgets: { data: null, error: { message: "Read failed" } } });
    const response = await GET(new Request("http://test"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Read failed" });
  });
  it.each([
    { data: null, error: null },
    { data: [{ id: "ignored", category_id: category, amount_cents: -50 }], error: { message: "Failed" } },
  ])("does not consume unavailable transaction/shared rows (%j)", async result => {
    setup({ budgets: { data: [], error: null }, transactions: result, shared_expenses: result }, true);
    expect(await (await GET(new Request("http://test?month=2026-12"))).json()).toEqual({ budgets: [], consumption: {} });
  });
  it("adds net shared expenses to net personal-source expenses, with December bounds", async () => {
    const { chains } = setup({
      budgets: { data: [{ id: "budget" }], error: null },
      transactions: { data: [{ id: "expense", category_id: category, amount_cents: -9000 }, { id: "second", category_id: category, amount_cents: -1000 }], error: null },
      shared_expenses: { data: [{ category_id: category, amount_cents: 9000, reimbursed_cents: 6000 }, { category_id: "other", amount_cents: 400, reimbursed_cents: null }, { category_id: "other", amount_cents: 500, reimbursed_cents: 900 }, { category_id: null, amount_cents: 999 }], error: null },
    }, true);
    const response = await GET(new Request("http://test?month=2026-12"));
    expect(await response.json()).toEqual({ budgets: [{ id: "budget" }], consumption: { [category]: 7000, other: 400 } });
    expect(chains.budgets.gte).toHaveBeenCalledWith("month", "2026-12-01");
    expect(chains.budgets.lt).toHaveBeenCalledWith("month", "2027-01-01");
    expect(chains.shared_expenses.lt).toHaveBeenCalledWith("date", "2027-01-01");
  });
  it.each([{}, { ...payload, amount_cents: 0 }, { ...payload, amount_cents: 1.5 }])("rejects invalid budget %j", async body => {
    const { from } = setup();
    expect((await POST(request(body))).status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
  it.each([[null, 201, { ok: true }], [{ code: "23505", message: "Duplicate" }, 409, { error: "Une enveloppe existe déjà pour cette catégorie ce mois" }], [{ code: "42501", message: "Denied" }, 400, { error: "Denied" }]] as const)("returns the write outcome %j", async (error, status, body) => {
    const { chains } = setup({ budgets: { data: null, error } });
    const response = await POST(request(payload));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(body);
    expect(chains.budgets.insert).toHaveBeenCalledWith({ ...payload, month: "2026-12-01", space_id: "space", user_id: "user" });
  });
});
