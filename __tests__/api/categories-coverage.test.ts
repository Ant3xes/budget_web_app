import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChainableMock } from "@/__tests__/mocks/supabase";
import { GET, POST } from "@/app/api/categories/route";
import { PATCH, DELETE } from "@/app/api/categories/[id]/route";
import { withSpace } from "@/lib/spaces/with-space";
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
const params = (id = "category") => ({ params: Promise.resolve({ id }) });
const request = (body: unknown = {}, method = "POST") => new Request("http://test/api/categories", { method, body: JSON.stringify(body) });
function setup(data: unknown = null, error: unknown = null) {
  const chain = createChainableMock({ data, error });
  const from = vi.fn(() => chain);
  vi.mocked(withSpace).mockResolvedValue({ user: { id: "user" }, spaceId: "space", supabase: { from } } as never);
  return { chain, from };
}
beforeEach(() => vi.resetAllMocks());
describe("category route boundary coverage", () => {
  it("denies every operation before reading data", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);
    for (const response of [await GET(), await POST(request()), await PATCH(request(), params()), await DELETE(request(), params())]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized" });
    }
  });
  it.each([null, [{ id: "category", name: "Synthetic" }]])("lists active categories with an empty fallback (%j)", async data => {
    const { chain } = setup(data);
    const response = await GET();
    expect(await response.json()).toEqual({ categories: data ?? [] });
    expect(chain.eq).toHaveBeenCalledWith("space_id", "space");
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(chain.order.mock.calls).toEqual([["kind"], ["name"]]);
  });
  it("reports read errors", async () => {
    setup(null, { message: "Read denied" });
    const response = await GET();
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Read denied" });
  });
  it.each(["POST", "PATCH"])("rejects invalid %s data without writes", async method => {
    const { from } = setup();
    const response = method === "POST" ? await POST(request({ name: " " })) : await PATCH(request({ name: " " }), params());
    expect(response.status).toBe(400);
    expect((await response.json()).error).toEqual(expect.any(String));
    expect(from).not.toHaveBeenCalled();
  });
  it.each(["PATCH", "DELETE"])("requires the id for %s", async method => {
    const { from } = setup();
    const response = method === "PATCH" ? await PATCH(request(), params("")) : await DELETE(request(), params(""));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing id" });
    expect(from).not.toHaveBeenCalled();
  });
  it.each(["POST", "PATCH", "DELETE"])("returns database failures for %s", async method => {
    setup(null, { message: "Write denied", code: "42501" });
    const response = method === "POST" ? await POST(request({ name: "Synthetic", kind: "expense", color: "blue", icon: "x" })) : method === "PATCH" ? await PATCH(request({ color: null }), params()) : await DELETE(request(), params());
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Write denied" });
  });
  it.each([
    [{ name: "Seed", is_default: true }, "Renamed", true],
    [{ name: "Seed", is_default: true }, "Seed", false],
    [{ name: "Seed", is_default: false }, "Renamed", false],
    [null, "Renamed", false],
  ])("only detaches the translation on an actual default rename (%j, %s)", async (existing, name, detach) => {
    const { chain, from } = setup();
    from.mockReturnValueOnce(createChainableMock({ data: existing, error: null }));
    const response = await PATCH(request({ name }), params());
    expect(response.status).toBe(200);
    expect(chain.update).toHaveBeenCalledWith(detach ? { name, is_default: false, translation_key: null } : { name });
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
  });
  it("color-only edits do not look up or detach a default name", async () => {
    const { chain, from } = setup();
    expect((await PATCH(request({ color: "blue" }), params())).status).toBe(200);
    expect(from).toHaveBeenCalledTimes(1);
    expect(chain.update).toHaveBeenCalledWith({ color: "blue" });
  });
  it("soft deletes only the active category in the active space", async () => {
    const { chain } = setup();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    try {
      const response = await DELETE(request(), params());
      expect(await response.json()).toEqual({ ok: true });
      expect(chain.update).toHaveBeenCalledWith({ deleted_at: "2026-01-01T00:00:00.000Z" });
      expect(chain.eq.mock.calls).toEqual([["id", "category"], ["space_id", "space"]]);
      expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
      expect(chain.delete).not.toHaveBeenCalled();
    } finally { vi.useRealTimers(); }
  });
});
