import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));

import { GET as getBudgets } from "@/app/api/budgets/route";
import { withSpace } from "@/lib/spaces/with-space";

const PERSONAL = { id: "11111111-1111-4111-8111-111111111111", name: "Perso", kind: "personal", role: "owner" };
const SHARED = { id: "22222222-2222-4222-8222-222222222222", name: "Foyer", kind: "shared", role: "owner" };
const CAT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CAT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

type Chain = Record<string, ReturnType<typeof vi.fn>>;

function buildSupabase(results: Record<string, { data: unknown; error: unknown }>) {
  const chains: Record<string, Chain> = {};
  const from = vi.fn((table: string) => {
    const result = results[table] ?? { data: [], error: null };
    const chain: Chain = {};
    for (const method of ["select", "eq", "is", "order", "gte", "lt"]) {
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

const mockAuth = (supabase: unknown, space: typeof SHARED | typeof PERSONAL) =>
  vi.mocked(withSpace).mockResolvedValue({
    supabase,
    user: { id: "u" },
    spaceId: space.id,
    space,
    spaces: [PERSONAL, SHARED],
  } as never);

const request = () => new Request("http://test/api/budgets?month=2026-09");

const results = () => ({
  budgets: { data: [], error: null },
  transactions: {
    data: [
      { category_id: CAT_A, amount_cents: -1000 },
      { category_id: null, amount_cents: -50 },
    ],
    error: null,
  },
  shared_expenses: {
    data: [
      { category_id: CAT_A, amount_cents: 500 },
      { category_id: CAT_B, amount_cents: 700 },
      { category_id: null, amount_cents: 999 },
    ],
    error: null,
  },
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/budgets consumption", () => {
  it("adds shared expenses by category in a shared space, using the month bounds", async () => {
    const db = buildSupabase(results());
    mockAuth(db, SHARED);

    const body = (await (await getBudgets(request())).json()) as { consumption: Record<string, number> };

    expect(body.consumption).toEqual({ [CAT_A]: 1500, [CAT_B]: 700 });
    const shared = db.chains.shared_expenses!;
    expect(shared.eq).toHaveBeenCalledWith("space_id", SHARED.id);
    expect(shared.gte).toHaveBeenCalledWith("date", "2026-09-01");
    expect(shared.lt).toHaveBeenCalledWith("date", "2026-10-01");
  });

  it("leaves personal spaces unchanged", async () => {
    const db = buildSupabase(results());
    mockAuth(db, PERSONAL);

    const body = (await (await getBudgets(request())).json()) as { consumption: Record<string, number> };

    expect(body.consumption).toEqual({ [CAT_A]: 1000 });
    expect(db.from).not.toHaveBeenCalledWith("shared_expenses");
  });
});
