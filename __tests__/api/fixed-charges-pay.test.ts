import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/fixed-charges/[id]/pay/route";
import { createChainableMock } from "@/__tests__/mocks/supabase";
import { todayISO } from "@/lib/dates/period";

const mockUser = { id: "user-test-id", email: "test@budget.local" };

function makeSupabase(charge: { next_due_date: string; frequency: string } | null) {
  const queryBuilder = createChainableMock({ data: charge, error: charge ? null : { message: "not found" } });
  return {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
    from: vi.fn(() => queryBuilder),
  };
}

function makeRequest() {
  return new Request("http://localhost/api/fixed-charges/charge-1/pay", { method: "POST" });
}

describe("POST /api/fixed-charges/:id/pay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "charge-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the charge doesn't exist (or isn't the user's)", async () => {
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabase(null) as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "charge-1" }) });
    expect(res.status).toBe(404);
  });

  it("records last_paid_date as today's local date and advances a not-yet-due monthly charge by one period", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const futureStr = future.toISOString().slice(0, 10);

    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabase({ next_due_date: futureStr, frequency: "monthly" }) as unknown as Awaited<
        ReturnType<typeof createServerSupabaseClient>
      >,
    );

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "charge-1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { next_due_date: string; last_paid_date: string };
    // Local-calendar-date, matching the dashboard's own query window — not a
    // UTC date, which could disagree with it near a day boundary.
    expect(body.last_paid_date).toBe(todayISO());
    // next_due_date must land strictly after today, not on the original future date.
    expect(body.next_due_date > todayISO()).toBe(true);
  });

  it("catches up a charge overdue by several periods to a genuinely future date, not just one step", async () => {
    const now = new Date();
    const wayOverdue = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 3, 1)).toISOString().slice(0, 10);

    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      makeSupabase({ next_due_date: wayOverdue, frequency: "monthly" }) as unknown as Awaited<
        ReturnType<typeof createServerSupabaseClient>
      >,
    );

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "charge-1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { next_due_date: string };
    // Overdue by 3 monthly periods — a single advanceOnePeriod step would
    // still land in the past; the route must keep catching up.
    expect(body.next_due_date > todayISO()).toBe(true);
  });
});
