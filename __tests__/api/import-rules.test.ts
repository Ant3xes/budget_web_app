import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
vi.mock("@/lib/import/rules", () => ({ nextRulePriority: vi.fn().mockResolvedValue(3) }));

import { GET, POST } from "@/app/api/import-rules/route";
import { PATCH } from "@/app/api/import-rules/[id]/route";
import { withSpace } from "@/lib/spaces/with-space";
import { createChainableMock } from "@/__tests__/mocks/supabase";

const mockUser = { id: "user-test-id", email: "test@budget.local" };
const CATEGORY_ID = "00000000-0000-4000-8000-000000000002";
const SHARED_ID = "00000000-0000-4000-8000-0000000000aa";
const OTHER_ID = "00000000-0000-4000-8000-0000000000bb";
const SHARE_CATEGORY_ID = "00000000-0000-4000-8000-0000000000dd";
const RULE_ID = "00000000-0000-4000-8000-0000000000ee";

const personal = { id: "space-test-id", name: "Personnel", kind: "personal", role: "owner" };
const shared = { id: SHARED_ID, name: "Colocation", kind: "shared", role: "member" };

function setup(result: { data: unknown; error: unknown } = { data: { id: RULE_ID }, error: null }, active = personal) {
  const builder = createChainableMock(result);
  const supabase = { from: vi.fn(() => builder) };
  vi.mocked(withSpace).mockResolvedValue({
    supabase,
    user: mockUser,
    spaceId: active.id,
    space: active,
    spaces: [personal, shared],
  } as never);
  return { supabase, builder };
}

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/import-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

const patch = (body: unknown) =>
  PATCH(
    new Request(`http://localhost/api/import-rules/${RULE_ID}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: RULE_ID }) },
  );

const base = { keyword: "netflix", category_id: CATEGORY_ID, kind: "expense" };

beforeEach(() => vi.clearAllMocks());

describe("GET /api/import-rules", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  it("selects the share columns and disambiguates the category embeds", async () => {
    const rules = [{ id: RULE_ID, share_space: { name: "Colocation" }, share_category: null, categories: { name: "x" } }];
    const { builder } = setup({ data: rules, error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(((await res.json()) as { rules: unknown[] }).rules).toEqual(rules);

    const select = builder.select.mock.calls[0]?.[0] as string;
    expect(select).toContain("share_space_id, share_category_id, share_payer_percent");
    expect(select).toContain("categories!csv_import_rules_category_id_fkey(name, icon)");
    expect(select).toContain("share_space:spaces!csv_import_rules_share_space_id_fkey(name)");
    expect(select).toContain("share_category:categories!csv_import_rules_share_category_id_fkey(name, icon)");
  });

  it("maps a DB error to 400", async () => {
    setup({ data: null, error: { message: "nope" } });
    expect((await GET()).status).toBe(400);
  });
});

describe("POST /api/import-rules", () => {
  it("creates a rule without share as before", async () => {
    const { builder } = setup();
    const res = await post(base);
    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith({
      ...base,
      space_id: "space-test-id",
      user_id: "user-test-id",
      priority: 3,
    });
  });

  it("creates a rule with a share", async () => {
    const { builder } = setup();
    const share = { share_space_id: SHARED_ID, share_category_id: SHARE_CATEGORY_ID, share_payer_percent: 40 };
    const res = await post({ ...base, ...share });
    expect(res.status).toBe(201);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining(share));
  });

  it("refuses a share on an income rule (400)", async () => {
    const { builder } = setup();
    const res = await post({ ...base, kind: "income", share_space_id: SHARED_ID });
    expect(res.status).toBe(400);
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it("refuses a share from a shared active space (400)", async () => {
    const { builder } = setup(undefined, shared);
    const res = await post({ ...base, share_space_id: SHARED_ID });
    expect(res.status).toBe(400);
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it("refuses a target that is not a shared space of the caller (403)", async () => {
    const { builder } = setup();
    expect((await post({ ...base, share_space_id: OTHER_ID })).status).toBe(403);
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it("validates share_payer_percent (0..100) and guids (400)", async () => {
    setup();
    expect((await post({ ...base, share_space_id: SHARED_ID, share_payer_percent: 101 })).status).toBe(400);
    expect((await post({ ...base, share_space_id: "nope" })).status).toBe(400);
  });

  it("maps DB errors with pgErrorResponse", async () => {
    for (const [code, status] of [["23514", 400], ["42501", 403], ["23505", 409]] as const) {
      setup({ data: null, error: { message: "boom", code } });
      expect((await post(base)).status).toBe(status);
    }
  });
});

describe("PATCH /api/import-rules/[id]", () => {
  it("updates a share, using the kind of the stored rule when the body has none", async () => {
    const { builder } = setup({ data: { kind: "expense" }, error: null });
    const res = await patch({ share_space_id: SHARED_ID, share_payer_percent: 25 });
    expect(res.status).toBe(200);
    expect(builder.select).toHaveBeenCalledWith("kind");
    expect(builder.update).toHaveBeenCalledWith({ share_space_id: SHARED_ID, share_payer_percent: 25 });
  });

  it("refuses a share when the stored rule is an income rule (400)", async () => {
    const { builder } = setup({ data: { kind: "income" }, error: null });
    expect((await patch({ share_space_id: SHARED_ID })).status).toBe(400);
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("uses the kind of the body without loading the rule", async () => {
    const { builder } = setup();
    expect((await patch({ kind: "income", share_space_id: SHARED_ID })).status).toBe(400);
    expect(builder.select).not.toHaveBeenCalled();
    expect((await patch({ kind: "expense", share_space_id: SHARED_ID })).status).toBe(200);
    expect(builder.select).not.toHaveBeenCalled();
  });

  it("returns 404 when the rule to check does not exist", async () => {
    setup({ data: null, error: null });
    expect((await patch({ share_space_id: SHARED_ID })).status).toBe(404);
  });

  it("refuses a foreign target (403) and a shared active space (400)", async () => {
    setup({ data: { kind: "expense" }, error: null });
    expect((await patch({ share_space_id: OTHER_ID })).status).toBe(403);
    setup({ data: { kind: "expense" }, error: null }, shared);
    expect((await patch({ share_space_id: SHARED_ID })).status).toBe(400);
  });

  it("clears the share with share_space_id: null, with no pre-check", async () => {
    const { builder } = setup();
    const res = await patch({ share_space_id: null });
    expect(res.status).toBe(200);
    expect(builder.select).not.toHaveBeenCalled();
    expect(builder.update).toHaveBeenCalledWith({ share_space_id: null });
  });

  it("stays partial: a keyword-only patch does not touch the share", async () => {
    const { builder } = setup();
    await patch({ keyword: "spotify" });
    expect(builder.update).toHaveBeenCalledWith({ keyword: "spotify" });
  });

  it("maps DB errors with pgErrorResponse", async () => {
    setup({ data: null, error: { message: "trigger", code: "23514" } });
    const res = await patch({ share_space_id: null });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("trigger");
    setup({ data: null, error: { message: "rls", code: "42501" } });
    expect((await patch({ share_space_id: null })).status).toBe(403);
  });
});
