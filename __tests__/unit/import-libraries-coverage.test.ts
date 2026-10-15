import { describe, expect, it, vi } from "vitest";
import { createChainableMock } from "@/__tests__/mocks/supabase";
import { parseN26Csv } from "@/lib/import/parse-n26";
import { normalizeLabel } from "@/lib/import/normalize-label";
import { createCategoryForImport } from "@/lib/import/create-category";
import { insertImportRules, nextRulePriority, upsertImportRule } from "@/lib/import/rules";

describe("import library edge coverage", () => {
  it("unescapes quoted payees and ignores short or empty date/amount rows", () => {
    const result = parseN26Csv('Booking Date,Amount (EUR),Payee,Type,Extra\n2026-01-01,-1,"The ""Synthetic"" Shop"\nshort\n,-2,Missing date\n2026-01-02,,Missing amount\n2026-01-03,-3');
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ description: 'The "Synthetic" Shop', amount_cents: -100, raw: { Type: "", Extra: "" } });
    expect(result[1]).toMatchObject({ description: "N26 transaction", amount_cents: -300 });
    expect(result[0]).not.toHaveProperty("source_type");
  });
  it("can parse a file without a payee column", () => {
    expect(parseN26Csv("Booking Date,Amount (EUR)\n2026-01-01,-2")[0]?.description).toBe("N26 transaction");
  });
  it("keeps short vowel-less words as acronyms but title-cases single letters and long ones", () => {
    expect(normalizeLabel("BTP B BCDFG", { source: "n26" })).toEqual({ clean: "BTP B Bcdfg", raw: "BTP B BCDFG" });
  });
  it.each([
    [new Response("failure", { status: 500 }), { ok: false, reason: "error", message: undefined }],
    [Response.json({ categories: [] }), { ok: false, reason: "error" }],
    [Response.json({}), { ok: false, reason: "error" }],
    [Response.json({ categories: [{ id: "wrong-kind", name: "Synthetic", kind: "income" }, { id: "wrong-name", name: "Other", kind: "expense" }] }), { ok: false, reason: "error" }],
  ])("does not claim creation when the refreshed list cannot resolve it", async (listResponse, expected) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ ok: true })).mockResolvedValueOnce(listResponse);
    expect(await createCategoryForImport("Synthetic", "expense", fetcher)).toEqual(expected);
    expect(fetcher).toHaveBeenLastCalledWith("/api/categories");
  });
  it("handles a non-JSON category creation error", async () => {
    expect(await createCategoryForImport("Synthetic", "expense", vi.fn<typeof fetch>().mockResolvedValue(new Response("bad", { status: 500 })))).toEqual({ ok: false, reason: "error", message: undefined });
  });
  it("starts priorities at zero when no rule exists", async () => {
    const chain = createChainableMock();
    expect(await nextRulePriority({ from: () => chain } as never, "space")).toBe(0);
    expect(chain.eq).toHaveBeenCalledWith("space_id", "space");
  });
  it.each([null, { message: "Insert denied" }])("handles null existing rules and batch insert outcomes %j", async error => {
    const read = createChainableMock();
    const write = createChainableMock({ data: null, error });
    const from = vi.fn().mockReturnValueOnce(read).mockReturnValue(write);
    expect(await insertImportRules({ from } as never, "space", "user", [{ keyword: " Synthetic ", category_id: "cat", kind: "expense" }])).toEqual({ inserted: error ? 0 : 1 });
    expect(write.insert).toHaveBeenCalledWith([{ keyword: "Synthetic", category_id: "cat", kind: "expense", priority: 0, space_id: "space", user_id: "user" }]);
  });
  it.each(["read", "update", "insert"])("propagates %s rule failures", async phase => {
    const error = { message: `${phase} denied` };
    const read = createChainableMock({ data: phase === "update" ? [{ id: "rule", keyword: "synthetic" }] : null, error: phase === "read" ? error : null });
    const priority = createChainableMock();
    const write = createChainableMock({ data: null, error });
    const from = vi.fn().mockReturnValueOnce(read);
    if (phase === "insert") from.mockReturnValueOnce(priority);
    from.mockReturnValue(write);
    expect(await upsertImportRule({ from } as never, "space", "user", { keyword: "Synthetic", category_id: "cat", kind: "expense" })).toEqual({ status: "error", message: error.message });
    if (phase === "read") expect(from).toHaveBeenCalledTimes(1);
    else if (phase === "update") expect(write.update).toHaveBeenCalledWith({ category_id: "cat" });
    else expect(write.insert).toHaveBeenCalledWith(expect.objectContaining({ keyword: "Synthetic", priority: 0 }));
  });
});
