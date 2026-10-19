import { must } from "@/__tests__/helpers/must";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));

import { withSpace } from "@/lib/spaces/with-space";
import { GET, POST } from "@/app/api/transactions/route";
import { PATCH, DELETE } from "@/app/api/transactions/[id]/route";
import { GET as getLinks, PUT as putLink } from "@/app/api/transactions/[id]/reimburses/route";
import { GET as getCandidates } from "@/app/api/transactions/reimbursement-candidates/route";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const CAT = "33333333-3333-4333-8333-333333333333";
const TX = "44444444-4444-4444-8444-444444444444";
const SPACE = "synthetic-space";
const row = { kind: "expense", transfer_id: null, account_id: A, amount_cents: -9000, date: "2026-10-01T00:00:00Z", description: "Synthetic shop", notes: "Original note", category_id: null };
const params = (id = TX) => ({ params: Promise.resolve({ id }) });
const request = (method = "GET", body?: unknown, query = "") => new Request(`http://localhost/api/transactions${query}`, {
  method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
type Result = { data?: unknown; error?: { message: string; code?: string } | null; count?: number | null };
function setup(...results: (Result | Error)[]) {
  const chains = results.map((result) => {
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "is", "in", "gte", "lte", "ilike", "order", "range", "update", "insert", "limit", "gt", "lt", "neq"]) {
      chain[method] = vi.fn(() => chain);
    }
    const resolve = () => result instanceof Error ? Promise.reject(result) : Promise.resolve({ data: null, error: null, ...result });
    chain.single = vi.fn(resolve);
    chain.maybeSingle = vi.fn(resolve);
    chain.then = vi.fn((fulfilled, rejected) => resolve().then(fulfilled, rejected));
    return chain;
  });
  let index = 0;
  const from = vi.fn(() => {
    if (!chains[index]) throw new Error("Unexpected database query");
    return chains[index++];
  });
  const rpc = vi.fn().mockResolvedValue({ error: null });
  vi.mocked(withSpace).mockResolvedValue({ supabase: { from, rpc }, user: { id: "synthetic-user" }, spaceId: SPACE, space: {}, spaces: [] } as never);
  return { chains, from, rpc };
}
const dbError = { message: "Synthetic database failure", code: "23514" };

beforeEach(() => { vi.clearAllMocks(); });

describe("malformed JSON bodies", () => {
  it.each(["POST", "PATCH"])("%s returns 400 instead of throwing a parser error", async (method) => {
    const db = setup({ data: row });
    const invalid = new Request("http://localhost/api/transactions", { method, body: "{" });
    const response = method === "POST" ? await POST(invalid) : await PATCH(invalid, params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(db.rpc).not.toHaveBeenCalled();
    expect(must(db.chains[0]).insert).not.toHaveBeenCalled();
    expect(must(db.chains[0]).update).not.toHaveBeenCalled();
  });
});

describe("reimbursement links", () => {
  it.each([getLinks, putLink])("requires an authenticated space", async (handler) => {
    vi.mocked(withSpace).mockResolvedValue(null);
    const response = await handler(request("PUT", { expense_id: CAT }), params());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it.each([{}, { expense_id: "invalid" }, { expense_id: 3 }])("rejects invalid link payload %j without a write", async (body) => {
    const db = setup();
    const response = await putLink(request("PUT", body), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid data" });
    expect(db.from).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without a write", async () => {
    const db = setup();
    const response = await putLink(new Request("http://localhost", { method: "PUT", body: "{" }), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid data" });
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each([CAT, null])("sets or removes a link (%s) only in the active space", async (expenseId) => {
    const db = setup({ data: [{ id: TX }] });
    const response = await putLink(request("PUT", { expense_id: expenseId }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(must(db.chains[0]).update).toHaveBeenCalledWith({ reimburses_transaction_id: expenseId });
    expect(must(must(db.chains[0]).eq).mock.calls).toEqual([["id", TX], ["space_id", SPACE]]);
    expect(must(db.chains[0]).is).toHaveBeenCalledWith("deleted_at", null);
    expect(must(db.chains[0]).select).toHaveBeenCalledWith("id");
  });

  it.each([null, []])("returns 404 if the source is missing or outside the active space (%j)", async (data) => {
    const db = setup({ data });
    const response = await putLink(request("PUT", { expense_id: CAT }), params());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(must(db.chains[0]).eq).toHaveBeenCalledWith("space_id", SPACE);
  });

  it.each([
    ["target is not an expense", "23514", 400],
    ["target belongs to another space", "42501", 403],
  ])("surfaces database rejection when %s", async (message, code, status) => {
    // Database triggers own target validation; this verifies the API error contract, not SQL enforcement.
    setup({ error: { message, code } });
    const response = await putLink(request("PUT", { expense_id: CAT }), params());
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });

  it("returns 404 for a transaction hidden by the space filter", async () => {
    const db = setup({ data: null });
    const response = await getLinks(request(), params());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(must(must(db.chains[0]).eq).mock.calls).toEqual([["id", TX], ["space_id", SPACE]]);
    expect(must(db.chains[0]).is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("propagates a failed source read", async () => {
    setup({ error: dbError });
    const response = await getLinks(request(), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: dbError.message });
  });

  it.each([[], null, [{ id: A, amount_cents: 2500 }, { id: B, amount_cents: 3500 }]])("returns all reimbursements for an expense (%j)", async (data) => {
    const db = setup({ data: { kind: "expense" } }, { data });
    const response = await getLinks(request(), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reimbursements: data ?? [], target: null });
    expect(must(must(db.chains[1]).eq).mock.calls).toEqual([["space_id", SPACE], ["reimburses_transaction_id", TX]]);
    expect(must(db.chains[1]).order).toHaveBeenCalledWith("date", { ascending: false });
    expect(must(db.chains[1]).is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("propagates a failed reimbursement list read", async () => {
    setup({ data: { kind: "expense" } }, { error: dbError });
    const response = await getLinks(request(), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: dbError.message });
  });

  it("does not query a target for an unlinked incoming transaction", async () => {
    const db = setup({ data: { kind: "income", reimburses_transaction_id: null } });
    expect(await (await getLinks(request(), params())).json()).toEqual({ reimbursements: [], target: null });
    expect(db.from).toHaveBeenCalledTimes(1);
  });

  it.each([null, { id: CAT, amount_cents: -9000 }])("returns a linked target or null when no active target is visible", async (data) => {
    const db = setup({ data: { kind: "income", reimburses_transaction_id: CAT } }, { data });
    const response = await getLinks(request(), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reimbursements: [], target: data });
    expect(must(must(db.chains[1]).eq).mock.calls).toEqual([["id", CAT], ["space_id", SPACE]]);
    expect(must(db.chains[1]).is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("propagates a failed target read", async () => {
    setup({ data: { kind: "transfer_credit", reimburses_transaction_id: CAT } }, { error: dbError });
    const response = await getLinks(request(), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: dbError.message });
  });
});

describe("reimbursement candidates", () => {
  it("requires authentication", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);
    const response = await getCandidates(request());
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
  it.each(["", "?for=transfer", "?for=incoming&exclude=bad"])("rejects invalid query %s", async (query) => {
    const db = setup();
    const response = await getCandidates(request("GET", undefined, query));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid query" });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("lists recent positive unlinked incoming candidates, excluding the source", async () => {
    const transactions = [{ id: B, amount_cents: 1200 }];
    const db = setup({ data: transactions });
    const response = await getCandidates(request("GET", undefined, `?for=incoming&exclude=${TX}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transactions });
    const c = db.chains[0];
    expect(must(c).eq).toHaveBeenCalledWith("space_id", SPACE);
    expect(must(c).in).toHaveBeenCalledWith("kind", ["income", "transfer_credit"]);
    expect(must(c).gt).toHaveBeenCalledWith("amount_cents", 0);
    expect(must(must(c).is).mock.calls).toEqual([["deleted_at", null], ["reimburses_transaction_id", null]]);
    expect(must(c).neq).toHaveBeenCalledWith("id", TX);
    expect(must(c).limit).toHaveBeenCalledWith(50);
    expect(must(c).order).toHaveBeenCalledWith("date", { ascending: false });
  });
  it("lists negative non-transfer expenses and normalizes an empty result", async () => {
    const db = setup({ data: null });
    const response = await getCandidates(request("GET", undefined, "?for=expense"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transactions: [] });
    expect(must(db.chains[0]).eq).toHaveBeenCalledWith("kind", "expense");
    expect(must(db.chains[0]).lt).toHaveBeenCalledWith("amount_cents", 0);
    expect(must(db.chains[0]).is).toHaveBeenCalledWith("transfer_id", null);
    expect(must(db.chains[0]).neq).not.toHaveBeenCalled();
  });
  it("propagates query errors", async () => {
    setup({ error: dbError });
    const response = await getCandidates(request("GET", undefined, "?for=expense"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: dbError.message });
  });
});

describe("transaction writes", () => {
  it.each([POST, (r: Request) => PATCH(r, params()), (r: Request) => DELETE(r, params())])("requires authentication", async (handler) => {
    vi.mocked(withSpace).mockResolvedValue(null);
    const response = await handler(request("POST", {}));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });
  it.each([PATCH, DELETE])("rejects a missing id before reading", async (handler) => {
    const db = setup();
    const response = await handler(request("PATCH", {}), params(""));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing id" });
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each([PATCH, DELETE])("returns 404 for a missing transaction scoped to the active space", async (handler) => {
    const db = setup({ data: null });
    const response = await handler(request("PATCH", {}), params());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
    expect(must(must(db.chains[0]).eq).mock.calls).toEqual([["id", TX], ["space_id", SPACE]]);
    expect(must(db.chains[0]).is).toHaveBeenCalledWith("deleted_at", null);
  });
  it("rejects invalid patch fields", async () => {
    const db = setup({ data: row });
    const response = await PATCH(request("PATCH", { amount_cents: 1.5 }), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(db.from).toHaveBeenCalledTimes(1);
  });
  it.each([PATCH, DELETE])("refuses individual transfer edits/deletes", async (handler) => {
    const db = setup({ data: { ...row, transfer_id: "synthetic-transfer" } });
    const response = await handler(request("PATCH", { description: "New label" }), params());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toContain("formulaire Virement");
    expect(db.from).toHaveBeenCalledTimes(1);
  });
  it.each([PATCH, DELETE])("surfaces a failed mutation", async (handler) => {
    setup({ data: row }, { error: dbError });
    const response = await handler(request("PATCH", { notes: null }), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: dbError.message });
  });
  it("soft deletes only the active transaction", async () => {
    const db = setup({ data: row }, {});
    const response = await DELETE(request("DELETE"), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    const deletedAt = must(must(must(db.chains[1]).update).mock.calls[0])[0].deleted_at;
    expect(new Date(deletedAt).toISOString()).toBe(deletedAt);
    expect(must(must(db.chains[1]).eq).mock.calls).toEqual([["id", TX], ["space_id", SPACE]]);
    expect(must(db.chains[1]).is).toHaveBeenCalledWith("deleted_at", null);
  });
  it("updates fields without creating a rule when the category is unchanged", async () => {
    const db = setup({ data: row }, {});
    const response = await PATCH(request("PATCH", { description: "  New label  ", notes: null }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, rule: null });
    expect(must(db.chains[1]).update).toHaveBeenCalledWith({ description: "New label", notes: null });
    expect(must(must(db.chains[1]).eq).mock.calls).toEqual([["id", TX], ["space_id", SPACE]]);
    expect(must(db.chains[1]).is).toHaveBeenCalledWith("deleted_at", null);
    expect(db.from).toHaveBeenCalledTimes(2);
  });
  it("creates an import rule from the new label and category", async () => {
    const db = setup({ data: row }, {}, { data: [] }, { data: { priority: 4 } }, {});
    const response = await PATCH(request("PATCH", { category_id: CAT, description: "Synthetic market" }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, rule: "created" });
    expect(db.from).toHaveBeenCalledTimes(5);
    expect(must(db.chains[4]).insert).toHaveBeenCalledWith({ keyword: "Synthetic market", category_id: CAT, kind: "expense", space_id: SPACE, user_id: "synthetic-user", priority: 5 });
  });
  it("updates an existing rule using the stored description", async () => {
    const db = setup({ data: row }, {}, { data: [{ id: "synthetic-rule", keyword: "SYNTHETIC SHOP" }] }, {});
    const response = await PATCH(request("PATCH", { category_id: CAT }), params());
    expect(await response.json()).toEqual({ ok: true, rule: "updated" });
    expect(must(db.chains[3]).update).toHaveBeenCalledWith({ category_id: CAT });
    expect(must(must(db.chains[3]).eq).mock.calls).toEqual([["id", "synthetic-rule"], ["space_id", SPACE]]);
  });
  it.each(["returned error", "thrown error"])("keeps the edit successful on rule %s", async (mode) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      setup({ data: row }, {}, mode === "returned error" ? { error: dbError } : new Error("Synthetic outage"));
      const response = await PATCH(request("PATCH", { category_id: CAT }), params());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, rule: null });
      expect(log).toHaveBeenCalledTimes(1);
      expect(String(log.mock.calls[0]![0])).toContain("Import rule upsert failed (issue 116)");
    } finally { log.mockRestore(); }
  });
  it("rejects invalid creation data before inserting", async () => {
    const db = setup();
    const response = await POST(request("POST", { description: "" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(db.from).not.toHaveBeenCalled();
  });
  it.each([false, true])("creates a transaction with optional fields present=%s", async (optional) => {
    const db = setup({});
    const body = { account_id: A, kind: "expense", amount_cents: -500, date: "2026-10-01", description: "  Synthetic shop  ", ...(optional ? { category_id: CAT, notes: "  Note  " } : {}) };
    const response = await POST(request("POST", body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(must(db.chains[0]).insert).toHaveBeenCalledWith({ ...body, description: "Synthetic shop", space_id: SPACE, user_id: "synthetic-user", category_id: optional ? CAT : null, notes: optional ? "Note" : null });
  });
  it("surfaces creation errors", async () => {
    setup({ error: dbError });
    const response = await POST(request("POST", { account_id: A, kind: "income", amount_cents: 500, date: "2026-10-01", description: "Synthetic" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: dbError.message });
  });
});

describe("type conversion", () => {
  it("rejects invalid plans before touching accounts", async () => {
    const db = setup({ data: row });
    const response = await PATCH(request("PATCH", { kind: "transfer" }), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Compte source et destination requis" });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("surfaces account lookup errors", async () => {
    const db = setup({ data: row }, { error: dbError });
    const response = await PATCH(request("PATCH", { kind: "income" }), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: dbError.message });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("rejects null account results as outside the active space", async () => {
    const db = setup({ data: row }, { data: null });
    const response = await PATCH(request("PATCH", { kind: "income" }), params());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Compte introuvable" });
    expect(must(db.chains[1]).eq).toHaveBeenCalledWith("space_id", SPACE);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("uses stored fields when converting without optional edits", async () => {
    const db = setup({ data: row }, { data: [{ id: A }] });
    const response = await PATCH(request("PATCH", { kind: "income" }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, rule: null });
    expect(db.rpc).toHaveBeenCalledWith("convert_transaction", {
      p_id: TX, p_space_id: SPACE, p_kind: "income", p_account_id: A, p_amount_cents: 9000,
      p_date: "2026-10-01", p_description: row.description, p_category_id: null, p_notes: row.notes,
      p_mirror_kind: null, p_mirror_account_id: null, p_mirror_amount_cents: null,
    });
  });
  it("converts income to expense with edited fields and creates its import rule", async () => {
    const db = setup({ data: { ...row, kind: "income", amount_cents: 9000 } }, { data: [{ id: B }] }, { data: { id: CAT } }, { data: [] }, { data: null }, {});
    const response = await PATCH(request("PATCH", { kind: "expense", account_id: B, amount_cents: 1200, date: "2026-10-02", description: "Synthetic new label", notes: null, category_id: CAT }), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, rule: "created" });
    expect(db.rpc).toHaveBeenCalledWith("convert_transaction", expect.objectContaining({ p_kind: "expense", p_account_id: B, p_amount_cents: -1200, p_date: "2026-10-02", p_description: "Synthetic new label", p_notes: null, p_category_id: CAT }));
    expect(must(must(db.chains[2]).eq).mock.calls).toEqual([["id", CAT], ["space_id", SPACE], ["kind", "expense"]]);
    expect(must(db.chains[5]).insert).toHaveBeenCalledWith(expect.objectContaining({ kind: "expense", category_id: CAT }));
  });
});

describe("transaction listing", () => {
  it.each(["?page=0", "?per_page=101", "?kind=unknown"])("rejects query %s", async (query) => {
    const db = setup();
    const response = await GET(request("GET", undefined, query));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("applies category/search filters and inclusive page bounds for income", async () => {
    const db = setup({ data: [], count: 29 });
    const response = await GET(request("GET", undefined, `?kind=income&category_id=${CAT}&q=synthetic&page=3&per_page=10`));
    expect(await response.json()).toEqual({ transactions: [], total: 29 });
    expect(must(db.chains[0]).eq).toHaveBeenCalledWith("category_id", CAT);
    expect(must(db.chains[0]).ilike).toHaveBeenCalledWith("description", "%synthetic%");
    expect(must(db.chains[0]).range).toHaveBeenCalledWith(20, 29);
    expect(must(db.chains[0]).in).toHaveBeenCalledWith("kind", ["income"]);
    expect(must(must(db.chains[0]).order).mock.calls).toEqual([["date", { ascending: false }], ["created_at", { ascending: false }]]);
  });
  it("does not include transfers in uncategorized results", async () => {
    const db = setup({ data: null, count: null });
    const response = await GET(request("GET", undefined, "?kind=transfer&uncategorized=true"));
    expect(await response.json()).toEqual({ transactions: [], total: 0 });
    expect(must(db.chains[0]).in).toHaveBeenCalledWith("kind", []);
    expect(must(db.chains[0]).range).toHaveBeenCalledWith(0, 24);
  });
  it("surfaces listing errors", async () => {
    setup({ error: dbError });
    const response = await GET(request());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: dbError.message });
  });
  it("keeps gross amounts, combines reimbursements and attaches transfer counterparts", async () => {
    const transactions = [
      { id: TX, kind: "expense", amount_cents: -9000 },
      { id: "unpaid", kind: "expense", amount_cents: -700 },
      { id: "transfer", kind: "transfer_debit", transfer_id: "pair", amount_cents: -1000 },
      { id: "missing-target", kind: "transfer_debit", transfer_id: "missing", amount_cents: -500 },
      { id: "income", kind: "income", amount_cents: 6000 },
    ];
    const db = setup({ data: transactions, count: 5 }, { data: [{ transfer_id: "pair", account_id: B, accounts: { name: "Synthetic savings" } }] }, { data: [{ reimburses_transaction_id: TX, amount_cents: 2500 }, { reimburses_transaction_id: TX, amount_cents: 3500 }, { reimburses_transaction_id: TX, amount_cents: -20 }] });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ total: 5, transactions: [
      { ...transactions[0], reimbursed_cents: 6000, net_cents: 3000, to_account: null },
      { ...transactions[1], reimbursed_cents: 0, net_cents: 700, to_account: null },
      { ...transactions[2], reimbursed_cents: 0, net_cents: null, to_account: { id: B, name: "Synthetic savings" } },
      { ...transactions[3], reimbursed_cents: 0, net_cents: null, to_account: null },
      { ...transactions[4], reimbursed_cents: 0, net_cents: null, to_account: null },
    ] });
    expect(must(db.chains[1]).in).toHaveBeenCalledWith("transfer_id", ["pair", "missing"]);
    expect(must(db.chains[2]).in).toHaveBeenCalledWith("reimburses_transaction_id", [TX, "unpaid"]);
    expect(must(db.chains[2]).eq).toHaveBeenCalledWith("space_id", SPACE);
    expect(must(db.chains[2]).is).toHaveBeenCalledWith("deleted_at", null);
  });
  it("normalizes a null reimbursement result", async () => {
    setup({ data: [{ id: TX, kind: "expense", amount_cents: -9000 }] }, { data: null });
    const response = await GET(request());
    expect(await response.json()).toEqual({ total: 0, transactions: [{ id: TX, kind: "expense", amount_cents: -9000, reimbursed_cents: 0, net_cents: 9000, to_account: null }] });
  });
});
