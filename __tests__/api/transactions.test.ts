import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: () => [],
      set: vi.fn(),
    }),
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/transactions/route";

const mockUser = { id: "user-test-id", email: "test@budget.local" };
const ACCOUNT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

function buildSupabaseMock(overrides: Record<string, unknown> = {}) {
  const queryChain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    ...overrides,
  };

  Object.defineProperty(queryChain, "then", {
    get() {
      const result = (overrides.result as unknown) ?? { data: [], error: null, count: 0 };
      return Promise.resolve(result).then.bind(Promise.resolve(result));
    },
  });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
    },
    from: vi.fn(() => queryChain),
    _queryChain: queryChain,
  };
}

describe("GET /api/transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const res = await GET(new Request("http://localhost/api/transactions"));
    expect(res.status).toBe(401);
  });

  it("defaults to all four kinds when kind is omitted", async () => {
    const txs = [
      { id: "1", kind: "expense" },
      { id: "2", kind: "income" },
      { id: "3", kind: "transfer_debit" },
      { id: "4", kind: "transfer_credit" },
    ];
    const supabase = buildSupabaseMock({
      result: { data: txs, error: null, count: 4 },
    });
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const res = await GET(new Request("http://localhost/api/transactions"));
    expect(res.status).toBe(200);
    expect(supabase._queryChain.in).toHaveBeenCalledWith("kind", [
      "expense",
      "income",
      "transfer_debit",
      "transfer_credit",
    ]);

    const body = (await res.json()) as { transactions: typeof txs; total: number };
    expect(body.transactions).toHaveLength(4);
    expect(body.total).toBe(4);
  });

  it("filters by account_id and date range", async () => {
    const supabase = buildSupabaseMock({
      result: { data: [{ id: "tx-1", kind: "expense" }], error: null, count: 1 },
    });
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const url = new URL("http://localhost/api/transactions");
    url.searchParams.set("account_id", ACCOUNT_ID);
    url.searchParams.set("date_from", "2026-07-01");
    url.searchParams.set("date_to", "2026-07-31");

    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(supabase._queryChain.eq).toHaveBeenCalledWith("account_id", ACCOUNT_ID);
    expect(supabase._queryChain.gte).toHaveBeenCalledWith("date", "2026-07-01");
    expect(supabase._queryChain.lte).toHaveBeenCalledWith("date", "2026-07-31");
  });

  it("filters by a single kind when provided", async () => {
    const supabase = buildSupabaseMock({
      result: { data: [], error: null, count: 0 },
    });
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const url = new URL("http://localhost/api/transactions");
    url.searchParams.set("kind", "expense");

    const res = await GET(new Request(url));
    expect(res.status).toBe(200);
    expect(supabase._queryChain.in).toHaveBeenCalledWith("kind", ["expense"]);
  });
});
