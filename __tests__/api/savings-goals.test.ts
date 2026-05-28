import { NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock next/headers (required by server.ts)
vi.mock("next/headers", () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      getAll: () => [],
      set: vi.fn(),
    }),
  ),
}));

// Mock the Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GET, POST } from "@/app/api/savings-goals/route";

const mockUser = { id: "user-test-id", email: "test@budget.local" };

function buildSupabaseMock(overrides: Record<string, unknown> = {}) {
  const queryChain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: "new-goal-id" }, error: null }),
    ...overrides,
  };
  // Make awaitable
  Object.defineProperty(queryChain, "then", {
    get() {
      const result = (overrides.result as unknown) ?? { data: [], error: null };
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

describe("GET /api/savings-goals", () => {
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

    const res = await GET();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });

  it("returns goals list when authenticated", async () => {
    const goals = [
      {
        id: "goal-1",
        name: "Vacances",
        target_amount_cents: 200000,
        current_amount_cents: 50000,
        deadline: null,
        color: "#3b82f6",
        icon: "🏖️",
        linked_category_id: null,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const supabase = buildSupabaseMock({ result: { data: goals, error: null } });
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const res = await GET();
    expect(res.status).toBe(200);
  });
});

describe("POST /api/savings-goals", () => {
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

    const req = new Request("http://localhost/api/savings-goals", {
      method: "POST",
      body: JSON.stringify({ name: "Test", target_amount_cents: 10000 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    const supabase = buildSupabaseMock();
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const req = new Request("http://localhost/api/savings-goals", {
      method: "POST",
      body: JSON.stringify({ name: "", target_amount_cents: -100 }), // invalid
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 201 with valid payload", async () => {
    const queryChain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: "new-goal-id" }, error: null }),
    };
    Object.defineProperty(queryChain, "then", {
      get() {
        return Promise.resolve({ data: [], error: null }).then.bind(
          Promise.resolve({ data: [], error: null }),
        );
      },
    });

    const supabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn(() => queryChain),
    };

    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const req = new Request("http://localhost/api/savings-goals", {
      method: "POST",
      body: JSON.stringify({ name: "Vacances", target_amount_cents: 200000 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});
