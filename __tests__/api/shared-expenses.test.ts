import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));

import { DELETE as unshare, PATCH as updateShared } from "@/app/api/shared-expenses/[id]/route";
import { POST as share } from "@/app/api/shared-expenses/route";
import { withSpace } from "@/lib/spaces/with-space";

const PERSONAL = { id: "11111111-1111-4111-8111-111111111111", name: "Perso", kind: "personal", role: "owner" };
const SHARED = { id: "22222222-2222-4222-8222-222222222222", name: "Foyer", kind: "shared", role: "owner" };
const USER_ID = "33333333-3333-4333-8333-333333333333";
const PARTNER_ID = "44444444-4444-4444-8444-444444444444";
const TX_ID = "55555555-5555-4555-8555-555555555555";
const EXPENSE_ID = "66666666-6666-4666-8666-666666666666";

type Result = { data?: unknown; error?: unknown };

/** Supabase double: each table resolves its own result; every chain is recorded per table. */
function buildSupabase(results: Record<string, Result | Result[]>) {
  const calls: Record<string, number> = {};
  const chains: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  const from = vi.fn((table: string) => {
    const entry = results[table] ?? { data: [], error: null };
    const index = calls[table] ?? 0;
    calls[table] = index + 1;
    const result = Array.isArray(entry) ? (entry[index] ?? entry[entry.length - 1]!) : entry;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "insert", "update", "delete", "eq", "in", "single", "maybeSingle"]) {
      chain[method] = vi.fn(() => chain);
    }
    Object.defineProperty(chain, "then", {
      get: () => Promise.resolve(result).then.bind(Promise.resolve(result)),
    });
    chains[table] = chain;
    return chain;
  });
  return { from, chains };
}

function mockAuth(supabase: unknown, space = PERSONAL) {
  vi.mocked(withSpace).mockResolvedValue({
    supabase,
    user: { id: USER_ID },
    spaceId: space.id,
    space,
    spaces: [PERSONAL, SHARED],
  } as never);
}

const json = (body: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(body) });
const params = (id = EXPENSE_ID) => ({ params: Promise.resolve({ id }) });

const body = { transaction_id: TX_ID, space_id: SHARED.id };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("shared-expenses: unauthenticated", () => {
  it("answers 401", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);
    const responses = await Promise.all([
      share(json(body)),
      updateShared(json({ category_id: null }), params()),
      unshare(json({}), params()),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
  });
});

describe("POST /api/shared-expenses", () => {
  const supabase = () =>
    buildSupabase({
      space_members: { data: [{ user_id: USER_ID }, { user_id: PARTNER_ID }], error: null },
      spaces: { data: { default_share_percent: 60 }, error: null },
      shared_expenses: { data: { id: EXPENSE_ID }, error: null },
    });

  it("rejects malformed ids and percents", async () => {
    mockAuth(supabase());
    expect((await share(json({ ...body, transaction_id: "nope" }))).status).toBe(400);
    expect((await share(json({ ...body, space_id: "nope" }))).status).toBe(400);
    expect((await share(json({ ...body, payer_share_percent: 101 }))).status).toBe(400);
  });

  it("refuses a personal space or a space the caller is not in", async () => {
    mockAuth(supabase());
    expect((await share(json({ ...body, space_id: PERSONAL.id }))).status).toBe(403);
    expect((await share(json({ ...body, space_id: "77777777-7777-4777-8777-777777777777" }))).status).toBe(403);
  });

  it("inserts the default split without amount or description, even from the personal space", async () => {
    const db = supabase();
    mockAuth(db, PERSONAL);

    const response = await share(json(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: EXPENSE_ID });
    const payload = db.chains.shared_expenses!.insert!.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload).toEqual({
      space_id: SHARED.id,
      source_transaction_id: TX_ID,
      paid_by: USER_ID,
      category_id: null,
      shares: { [USER_ID]: 60, [PARTNER_ID]: 40 },
    });
    expect(payload).not.toHaveProperty("amount_cents");
    expect(payload).not.toHaveProperty("description");
    const shares = payload.shares as Record<string, number>;
    expect(Object.values(shares).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("uses an explicit payer_share_percent over the default", async () => {
    const db = supabase();
    mockAuth(db);
    await share(json({ ...body, payer_share_percent: 25, category_id: "88888888-8888-4888-8888-888888888888" }));
    const payload = db.chains.shared_expenses!.insert!.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.shares).toEqual({ [USER_ID]: 25, [PARTNER_ID]: 75 });
    expect(payload.category_id).toBe("88888888-8888-4888-8888-888888888888");
  });

  it.each([
    ["23514", 400],
    ["23505", 409],
    ["42501", 403],
    ["XX000", 400],
  ])("maps Postgres error %s to %i", async (code, status) => {
    mockAuth(
      buildSupabase({
        space_members: { data: [{ user_id: USER_ID }], error: null },
        spaces: { data: { default_share_percent: 50 }, error: null },
        shared_expenses: { data: null, error: { code, message: "boom" } },
      }),
    );
    const response = await share(json(body));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: "boom" });
  });
});

describe("PATCH /api/shared-expenses/[id]", () => {
  it("validates the id and requires at least one field", async () => {
    mockAuth(buildSupabase({}), SHARED);
    expect((await updateShared(json({ category_id: null }), params("nope"))).status).toBe(400);
    expect((await updateShared(json({}), params())).status).toBe(400);
  });

  it("updates only the category without loading members", async () => {
    const db = buildSupabase({ shared_expenses: { data: [{ id: EXPENSE_ID }], error: null } });
    mockAuth(db, SHARED);

    const response = await updateShared(json({ category_id: null }), params());

    expect(response.status).toBe(200);
    expect(db.chains.shared_expenses!.update).toHaveBeenCalledWith({ category_id: null });
    expect(db.from).not.toHaveBeenCalledWith("space_members");
  });

  it("recomputes shares with the current members of the expense space", async () => {
    const db = buildSupabase({
      shared_expenses: [
        { data: { space_id: SHARED.id, paid_by: USER_ID }, error: null },
        { data: [{ id: EXPENSE_ID }], error: null },
      ],
      space_members: { data: [{ user_id: USER_ID }, { user_id: PARTNER_ID }], error: null },
    });
    mockAuth(db, SHARED);

    const response = await updateShared(json({ payer_share_percent: 70 }), params());

    expect(response.status).toBe(200);
    expect(db.chains.shared_expenses!.update).toHaveBeenCalledWith({ shares: { [USER_ID]: 70, [PARTNER_ID]: 30 } });
  });

  it("is 403 when RLS silently matched no row", async () => {
    mockAuth(buildSupabase({ shared_expenses: { data: [], error: null } }), SHARED);
    expect((await updateShared(json({ category_id: null }), params())).status).toBe(403);
  });

  it("is 404 when the expense to re-split is not visible", async () => {
    mockAuth(buildSupabase({ shared_expenses: { data: null, error: null } }), SHARED);
    expect((await updateShared(json({ payer_share_percent: 50 }), params())).status).toBe(404);
  });

  it("maps 23514 to 400", async () => {
    mockAuth(
      buildSupabase({ shared_expenses: { data: null, error: { code: "23514", message: "category belongs to another space" } } }),
      SHARED,
    );
    const response = await updateShared(json({ category_id: TX_ID }), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "category belongs to another space" });
  });
});

describe("DELETE /api/shared-expenses/[id]", () => {
  it("validates the id", async () => {
    mockAuth(buildSupabase({}));
    expect((await unshare(json({}), params("nope"))).status).toBe(400);
  });

  it("is 403 when nothing was deleted (not the payer)", async () => {
    mockAuth(buildSupabase({ shared_expenses: { data: [], error: null } }));
    expect((await unshare(json({}), params())).status).toBe(403);
  });

  it("succeeds for the payer", async () => {
    mockAuth(buildSupabase({ shared_expenses: { data: [{ id: EXPENSE_ID }], error: null } }));
    const response = await unshare(json({}), params());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
