import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createChainableMock } from "@/__tests__/mocks/supabase";
import { POST } from "@/app/api/categories/route";
import { PATCH } from "@/app/api/categories/[id]/route";
import { withSpace } from "@/lib/spaces/with-space";

vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));

const migrationPath = "supabase/migrations/20261015090000_categories_active_unique.sql";

function request(method: string) {
  return new Request("http://localhost/api/categories/category-test-id", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Test category", kind: "expense" }),
  });
}

function mockDatabase(error: { code: string; message: string } | null) {
  const existing = createChainableMock({
    data: { name: "Previous category", is_default: false },
    error: null,
  });
  const write = createChainableMock({ data: null, error });
  const from = vi.fn(() => write);
  from.mockReturnValueOnce(existing);
  vi.mocked(withSpace).mockResolvedValue({
    user: { id: "user-test-id" },
    spaceId: "space-test-id",
    supabase: { from },
  } as unknown as NonNullable<Awaited<ReturnType<typeof withSpace>>>);
  return { existing, write, from };
}

describe("category uniqueness migration", () => {
  it("keeps default seeding compatible with the partial index without changing its defaults", () => {
    const sql = readFileSync(migrationPath, "utf8");
    const previous = readFileSync("supabase/migrations/20260924120000_spaces.sql", "utf8");
    const seed = (source: string) => source.match(/create or replace function public\.seed_default_categories\(p_space_id uuid, p_user_id uuid\)[\s\S]*?\$\$;/i)?.[0];
    const expected = seed(previous)?.replace(
      "on conflict (space_id, name, kind) do nothing;",
      "on conflict (space_id, name, kind) where deleted_at is null do nothing;",
    );
    expect(expected).toBeDefined();
    expect(seed(sql)).toBe(expected);
  });

  it("replaces the full constraint with an active-only unique index without changing rows", () => {
    const sql = readFileSync(migrationPath, "utf8").replace(/--[^\n]*/g, "");
    expect(sql).toMatch(/alter table public\.categories\s+drop constraint categories_space_id_name_kind_key\s*;/i);
    expect(sql).toMatch(/create unique index categories_space_id_name_kind_active_key\s+on public\.categories\s*\(space_id, name, kind\)\s+where deleted_at is null\s*;/i);
    const ddl = sql.split(/create or replace function/i)[0];
    expect(ddl).not.toMatch(/\b(insert|update|delete|truncate)\b/i);
  });
});

describe.each(["POST", "PATCH"])("%s category name reuse", (method) => {
  beforeEach(() => vi.clearAllMocks());

  async function invoke() {
    return method === "POST"
      ? POST(request(method))
      : PATCH(request(method), { params: Promise.resolve({ id: "category-test-id" }) });
  }

  it("accepts the database write when only a deleted category has that name", async () => {
    // The migrated database accepts this write; mock only the Supabase boundary.
    const { existing, write, from } = mockDatabase(null);
    if (method === "POST") from.mockReset().mockReturnValue(write);

    const response = await invoke();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(from).toHaveBeenCalledTimes(method === "POST" ? 1 : 2);
    expect(from).toHaveBeenCalledWith("categories");
    if (method === "POST") {
      expect(write.insert).toHaveBeenCalledWith({
        space_id: "space-test-id",
        user_id: "user-test-id",
        name: "Test category",
        kind: "expense",
        color: null,
        icon: null,
      });
    } else {
      expect(existing.eq).toHaveBeenCalledWith("id", "category-test-id");
      expect(existing.eq).toHaveBeenCalledWith("space_id", "space-test-id");
      expect(write.update).toHaveBeenCalledWith({ name: "Test category", kind: "expense" });
      expect(write.eq).toHaveBeenCalledWith("id", "category-test-id");
      expect(write.eq).toHaveBeenCalledWith("space_id", "space-test-id");
      expect(write.is).toHaveBeenCalledWith("deleted_at", null);
    }
  });

  it("refuses a real active-category collision with a clear message", async () => {
    const message = 'duplicate key value violates unique constraint "categories_space_id_name_kind_active_key"';
    const { write, from } = mockDatabase({ code: "23505", message });
    if (method === "POST") from.mockReset().mockReturnValue(write);

    const response = await invoke();

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Une catégorie portant ce nom existe déjà" });
  });
});
