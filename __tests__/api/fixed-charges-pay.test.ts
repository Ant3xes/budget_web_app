import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));

import { withSpace } from "@/lib/spaces/with-space";
import { POST } from "@/app/api/fixed-charges/[id]/pay/route";
import { createChainableMock } from "@/__tests__/mocks/supabase";
import { todayISO } from "@/lib/dates/period";

const mockUser = { id: "user-test-id", email: "test@budget.local" };
const mockSpace = { id: "space-test-id", name: "Personnel", kind: "personal", role: "owner" };

function mockAuth(supabase: unknown) {
  vi.mocked(withSpace).mockResolvedValue({
    supabase,
    user: mockUser,
    spaceId: "space-test-id",
    space: mockSpace,
    spaces: [],
  } as never);
}

function makeSupabase(charge: { next_due_date: string; frequency: string } | null) {
  const queryBuilder = createChainableMock({ data: charge, error: charge ? null : { message: "not found" } });
  return {
    from: vi.fn(() => queryBuilder),
    _queryBuilder: queryBuilder,
  };
}

function makeRequest() {
  return new Request("http://localhost/api/fixed-charges/charge-1/pay", { method: "POST" });
}

describe("POST /api/fixed-charges/:id/pay", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "charge-1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 404 when the charge doesn't exist (or isn't the user's)", async () => {
    mockAuth(makeSupabase(null));

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "charge-1" }) });
    expect(res.status).toBe(404);
  });

  it("records last_paid_date as today's local date and advances a not-yet-due monthly charge by one period", async () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const futureStr = future.toISOString().slice(0, 10);

    const supabase = makeSupabase({ next_due_date: futureStr, frequency: "monthly" });
    mockAuth(supabase);

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "charge-1" }) });
    expect(res.status).toBe(200);
    // Lookup and update are both scoped by the active space.
    expect(supabase._queryBuilder.eq).toHaveBeenCalledWith("space_id", "space-test-id");
    expect(supabase._queryBuilder.eq).not.toHaveBeenCalledWith("user_id", expect.anything());
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

    mockAuth(makeSupabase({ next_due_date: wayOverdue, frequency: "monthly" }));

    const res = await POST(makeRequest(), { params: Promise.resolve({ id: "charge-1" }) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { next_due_date: string };
    // Overdue by 3 monthly periods — a single advanceOnePeriod step would
    // still land in the past; the route must keep catching up.
    expect(body.next_due_date > todayISO()).toBe(true);
  });
});
