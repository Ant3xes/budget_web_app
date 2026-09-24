import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));

import { GET as candidates } from "@/app/api/settlements/candidates/route";
import { DELETE as deleteSettlement } from "@/app/api/settlements/[id]/route";
import { POST as createSettlement } from "@/app/api/settlements/route";
import { withSpace } from "@/lib/spaces/with-space";

const PERSONAL = { id: "11111111-1111-4111-8111-111111111111", name: "Perso", kind: "personal", role: "owner" };
const SHARED = { id: "22222222-2222-4222-8222-222222222222", name: "Foyer", kind: "shared", role: "owner" };
const USER_ID = "33333333-3333-4333-8333-333333333333";
const PARTNER_ID = "44444444-4444-4444-8444-444444444444";
const TX_ID = "55555555-5555-4555-8555-555555555555";
const SETTLEMENT_ID = "66666666-6666-4666-8666-666666666666";

type Result = { data?: unknown; error?: unknown };
type Chain = Record<string, ReturnType<typeof vi.fn>>;

function buildSupabase(results: Record<string, Result>) {
  const chains: Record<string, Chain> = {};
  const from = vi.fn((table: string) => {
    const result = results[table] ?? { data: [], error: null };
    const chain: Chain = {};
    for (const method of ["select", "insert", "delete", "eq", "in", "not", "is", "gt", "order", "limit", "single"]) {
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

function mockAuth(supabase: unknown, space = SHARED) {
  vi.mocked(withSpace).mockResolvedValue({
    supabase,
    user: { id: USER_ID },
    spaceId: space.id,
    space,
    spaces: [PERSONAL, SHARED],
  } as never);
}

const json = (body: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(body) });
const params = (id = SETTLEMENT_ID) => ({ params: Promise.resolve({ id }) });

const valid = { from_user: USER_ID, to_user: PARTNER_ID, amount_cents: 1500 };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("settlements: unauthenticated", () => {
  it("answers 401", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);
    const responses = await Promise.all([
      createSettlement(json(valid)),
      deleteSettlement(json({}), params()),
      candidates(),
    ]);
    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
  });
});

describe("POST /api/settlements", () => {
  it("is 400 in a personal space", async () => {
    mockAuth(buildSupabase({}), PERSONAL);
    expect((await createSettlement(json(valid))).status).toBe(400);
  });

  it("validates ids, amount and the amount/source requirement", async () => {
    mockAuth(buildSupabase({}));
    expect((await createSettlement(json({ ...valid, from_user: "nope" }))).status).toBe(400);
    expect((await createSettlement(json({ ...valid, amount_cents: 0 }))).status).toBe(400);
    expect((await createSettlement(json({ ...valid, amount_cents: 1.5 }))).status).toBe(400);
    expect((await createSettlement(json({ from_user: USER_ID, to_user: PARTNER_ID }))).status).toBe(400);
  });

  it("inserts scoped to the active space with an explicit amount", async () => {
    const db = buildSupabase({ settlements: { data: { id: SETTLEMENT_ID }, error: null } });
    mockAuth(db);

    const response = await createSettlement(json({ ...valid, date: "2026-09-01T10:00:00.000Z" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: SETTLEMENT_ID });
    expect(db.chains.settlements!.insert).toHaveBeenCalledWith({
      space_id: SHARED.id,
      created_by: USER_ID,
      from_user: USER_ID,
      to_user: PARTNER_ID,
      amount_cents: 1500,
      date: "2026-09-01T10:00:00.000Z",
    });
  });

  it("accepts the plain YYYY-MM-DD sent by the settlement form and stores it at noon UTC", async () => {
    const db = buildSupabase({ settlements: { data: { id: SETTLEMENT_ID }, error: null } });
    mockAuth(db);

    const response = await createSettlement(json({ ...valid, date: "2026-09-24" }));

    expect(response.status).toBe(200);
    expect(db.chains.settlements!.insert).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-09-24T12:00:00Z" }),
    );
  });

  it("rejects a malformed date", async () => {
    mockAuth(buildSupabase({}));
    expect((await createSettlement(json({ ...valid, date: "24/09/2026" }))).status).toBe(400);
  });

  it("with a source transaction, lets the trigger fill the amount", async () => {
    const db = buildSupabase({ settlements: { data: { id: SETTLEMENT_ID }, error: null } });
    mockAuth(db);

    const response = await createSettlement(
      json({ from_user: PARTNER_ID, to_user: USER_ID, source_transaction_id: TX_ID }),
    );

    expect(response.status).toBe(200);
    const payload = db.chains.settlements!.insert!.mock.calls[0]![0] as Record<string, unknown>;
    expect(payload.source_transaction_id).toBe(TX_ID);
    expect(payload).not.toHaveProperty("amount_cents");
  });

  it.each([
    ["23514", 400],
    ["23505", 409],
    ["42501", 403],
  ])("maps Postgres error %s to %i", async (code, status) => {
    mockAuth(buildSupabase({ settlements: { data: null, error: { code, message: "boom" } } }));
    expect((await createSettlement(json(valid))).status).toBe(status);
  });
});

describe("DELETE /api/settlements/[id]", () => {
  it("validates the id", async () => {
    mockAuth(buildSupabase({}));
    expect((await deleteSettlement(json({}), params("nope"))).status).toBe(400);
  });

  it("filters on the active space and is 403 when nothing matched", async () => {
    const db = buildSupabase({ settlements: { data: [], error: null } });
    mockAuth(db);
    expect((await deleteSettlement(json({}), params())).status).toBe(403);
    expect(db.chains.settlements!.eq).toHaveBeenCalledWith("space_id", SHARED.id);
  });

  it("succeeds for the creator", async () => {
    mockAuth(buildSupabase({ settlements: { data: [{ id: SETTLEMENT_ID }], error: null } }));
    expect((await deleteSettlement(json({}), params())).status).toBe(200);
  });
});

describe("GET /api/settlements/candidates", () => {
  it("is 400 in a personal space", async () => {
    mockAuth(buildSupabase({}), PERSONAL);
    expect((await candidates()).status).toBe(400);
  });

  it("reads the personal space and excludes transactions already linked", async () => {
    const rows = [{ id: TX_ID, date: "2026-09-01T00:00:00Z", description: "Virement", amount_cents: 1500 }];
    const db = buildSupabase({
      settlements: { data: [{ source_transaction_id: "99999999-9999-4999-8999-999999999999" }], error: null },
      transactions: { data: rows, error: null },
    });
    mockAuth(db);

    const response = await candidates();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ transactions: rows });
    const tx = db.chains.transactions!;
    expect(tx.eq).toHaveBeenCalledWith("space_id", PERSONAL.id);
    expect(tx.in).toHaveBeenCalledWith("kind", ["income", "transfer_credit"]);
    expect(tx.not).toHaveBeenCalledWith("id", "in", "(99999999-9999-4999-8999-999999999999)");
    expect(tx.limit).toHaveBeenCalledWith(50);
    expect(db.chains.settlements!.eq).toHaveBeenCalledWith("space_id", SHARED.id);
  });

  it("does not add an exclusion filter when nothing is linked", async () => {
    const db = buildSupabase({ settlements: { data: [], error: null }, transactions: { data: [], error: null } });
    mockAuth(db);
    await candidates();
    expect(db.chains.transactions!.not).not.toHaveBeenCalled();
  });
});
