import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
vi.mock("@/lib/spaces/active-cookie", () => ({ setActiveSpaceCookie: vi.fn() }));

import { DELETE as deleteInvitation } from "@/app/api/invitations/[id]/route";
import { POST as createInvitation } from "@/app/api/invitations/route";
import { DELETE as deleteSpace } from "@/app/api/spaces/[id]/route";
import { DELETE as removeMember } from "@/app/api/spaces/[id]/members/[userId]/route";
import { POST as switchSpace } from "@/app/api/spaces/active/route";
import { POST as createSpace } from "@/app/api/spaces/route";
import { setActiveSpaceCookie } from "@/lib/spaces/active-cookie";
import { withSpace } from "@/lib/spaces/with-space";

const PERSONAL = { id: "11111111-1111-4111-8111-111111111111", name: "Personnel", kind: "personal", role: "owner" };
const SHARED = { id: "22222222-2222-4222-8222-222222222222", name: "Foyer", kind: "shared", role: "owner" };
const USER_ID = "33333333-3333-4333-8333-333333333333";

const json = (body: unknown) => new Request("http://test", { method: "POST", body: JSON.stringify(body) });

/** Supabase double whose chain resolves to `result` and records the calls made on it. */
function buildSupabase(result: { data?: unknown; error?: unknown; count?: number } = { data: [], error: null }) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "insert", "update", "delete", "eq"]) {
    chain[method] = vi.fn(() => chain);
  }
  Object.defineProperty(chain, "then", {
    get: () => Promise.resolve(result).then.bind(Promise.resolve(result)),
  });
  return { from: vi.fn(() => chain), rpc: vi.fn(() => Promise.resolve(result)), chain };
}

function mockAuth(space = SHARED, supabase: unknown = buildSupabase()) {
  vi.mocked(withSpace).mockResolvedValue({
    supabase,
    user: { id: USER_ID, email: "a@test.local" },
    spaceId: space.id,
    space,
    spaces: [PERSONAL, SHARED],
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("unauthenticated", () => {
  it("answers 401 on every space route", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);
    const params = Promise.resolve({ id: SHARED.id, userId: USER_ID });

    const responses = await Promise.all([
      createSpace(json({ name: "Foyer" })),
      switchSpace(json({ spaceId: SHARED.id })),
      createInvitation(json({ email: "b@test.local" })),
      deleteSpace(json({}), { params }),
      removeMember(json({}), { params }),
      deleteInvitation(json({}), { params }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401, 401, 401, 401]);
  });
});

describe("POST /api/spaces/active", () => {
  it("switches to a space the caller belongs to", async () => {
    mockAuth();
    const response = await switchSpace(json({ spaceId: SHARED.id }));

    expect(response.status).toBe(200);
    expect(setActiveSpaceCookie).toHaveBeenCalledWith(SHARED.id);
  });

  it("accepts ids that are not RFC v4 (the dev seed uses c0000000-0000-0000-0000-…)", async () => {
    const seedSpace = { ...SHARED, id: "c0000000-0000-0000-0000-000000000001" };
    vi.mocked(withSpace).mockResolvedValue({
      supabase: buildSupabase(),
      user: { id: USER_ID },
      spaceId: PERSONAL.id,
      space: PERSONAL,
      spaces: [PERSONAL, seedSpace],
    } as never);

    const response = await switchSpace(json({ spaceId: seedSpace.id }));

    expect(response.status).toBe(200);
    expect(setActiveSpaceCookie).toHaveBeenCalledWith(seedSpace.id);
  });

  it("refuses a space the caller is not a member of", async () => {
    mockAuth();
    const response = await switchSpace(json({ spaceId: "44444444-4444-4444-8444-444444444444" }));

    expect(response.status).toBe(403);
    expect(setActiveSpaceCookie).not.toHaveBeenCalled();
  });

  it("rejects a malformed id", async () => {
    mockAuth();
    expect((await switchSpace(json({ spaceId: "nope" }))).status).toBe(400);
  });
});

describe("POST /api/spaces", () => {
  it("creates a shared space through the RPC and switches to it", async () => {
    const supabase = buildSupabase({ data: SHARED.id, error: null });
    mockAuth(PERSONAL, supabase);

    const response = await createSpace(json({ name: "  Foyer  " }));

    expect(response.status).toBe(200);
    expect(supabase.rpc).toHaveBeenCalledWith("create_shared_space", { p_name: "Foyer" });
    expect(setActiveSpaceCookie).toHaveBeenCalledWith(SHARED.id);
  });

  it("rejects an empty name", async () => {
    mockAuth(PERSONAL);
    expect((await createSpace(json({ name: "   " }))).status).toBe(400);
  });
});

describe("POST /api/invitations", () => {
  it("refuses to share a personal space", async () => {
    mockAuth(PERSONAL);
    const response = await createInvitation(json({ email: "b@test.local" }));

    expect(response.status).toBe(400);
  });

  it("creates an invitation scoped to the active shared space", async () => {
    const supabase = buildSupabase({ data: [], error: null, count: 0 });
    mockAuth(SHARED, supabase);

    const response = await createInvitation(json({ email: "b@test.local" }));
    const body = (await response.json()) as { inviteLink: string };

    expect(response.status).toBe(200);
    expect(body.inviteLink).toMatch(/\/invite\/[0-9a-f-]{36}$/);
    expect(supabase.chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        space_id: SHARED.id,
        inviter_user_id: USER_ID,
        invitee_email: "b@test.local",
        status: "pending",
      }),
    );
  });
});

describe("silent RLS refusals", () => {
  // RLS filters forbidden rows out instead of erroring, so the routes must
  // turn an empty result into a refusal.
  const params = () => Promise.resolve({ id: SHARED.id, userId: USER_ID });

  it("DELETE /api/spaces/[id] is forbidden when no row was deleted", async () => {
    mockAuth(SHARED, buildSupabase({ data: [], error: null }));
    expect((await deleteSpace(json({}), { params: params() })).status).toBe(403);
  });

  it("DELETE /api/spaces/[id] succeeds when the owner deleted the row", async () => {
    mockAuth(SHARED, buildSupabase({ data: [{ id: SHARED.id }], error: null }));
    expect((await deleteSpace(json({}), { params: params() })).status).toBe(200);
  });

  it("DELETE member is forbidden when RLS matched nothing", async () => {
    mockAuth(SHARED, buildSupabase({ data: [], error: null }));
    expect((await removeMember(json({}), { params: params() })).status).toBe(403);
  });

  it("DELETE invitation is 404 when nothing pending matched", async () => {
    mockAuth(SHARED, buildSupabase({ data: [], error: null }));
    expect((await deleteInvitation(json({}), { params: params() })).status).toBe(404);
  });
});
