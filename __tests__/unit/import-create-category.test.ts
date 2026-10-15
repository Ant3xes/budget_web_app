import { describe, expect, it, vi } from "vitest";

import { createCategoryForImport } from "@/lib/import/create-category";

const json = (status: number, body: unknown) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

const cat = { id: "c1", name: "Sport", kind: "expense", icon: null };

describe("createCategoryForImport", () => {
  it("rejects an empty name without calling the API", async () => {
    const f = vi.fn();
    expect(await createCategoryForImport("  ", "expense", f as never)).toEqual({ ok: false, reason: "empty" });
    expect(f).not.toHaveBeenCalled();
  });

  it("posts name + kind then returns the created category from the refreshed list", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(json(200, { ok: true }))
      .mockResolvedValueOnce(json(200, { categories: [{ ...cat, id: "x", kind: "income" }, cat] }));
    const r = await createCategoryForImport(" sport ", "expense", f as never);
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ name: "sport", kind: "expense" });
    expect(r.ok && r.category.id).toBe("c1");
  });

  it("reports a duplicate on 409", async () => {
    const f = vi.fn().mockResolvedValueOnce(json(409, { error: "x" }));
    expect(await createCategoryForImport("Sport", "expense", f as never)).toEqual({ ok: false, reason: "duplicate" });
  });

  it("reports other API errors with their message", async () => {
    const f = vi.fn().mockResolvedValueOnce(json(400, { error: "bad" }));
    expect(await createCategoryForImport("Sport", "expense", f as never)).toEqual({
      ok: false,
      reason: "error",
      message: "bad",
    });
  });
});
