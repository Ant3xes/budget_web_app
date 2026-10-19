import { must } from "@/__tests__/helpers/must";
import { describe, expect, it } from "vitest";

import { ruleFromCategoryChange, upsertImportRule } from "@/lib/import/rules";

type Row = { id: string; keyword: string; kind: string; category_id: string; priority: number; space_id: string };

/** Minimal in-memory csv_import_rules table behind a supabase-like builder. */
function makeSupabase(rows: Row[]) {
  const from = () => {
    const filters: Record<string, unknown> = {};
    let mode: "select" | "update" | "insert" = "select";
    let patch: Record<string, unknown> = {};
    let ordered = false;
    let limited = false;
    const run = () => {
      const matching = rows.filter((r) => Object.entries(filters).every(([k, v]) => (r as Record<string, unknown>)[k] === v));
      if (mode === "update") matching.forEach((r) => Object.assign(r, patch));
      let result = matching;
      if (ordered) result = [...result].sort((a, b) => b.priority - a.priority);
      return { data: result, error: null };
    };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: (k: string, v: unknown) => ((filters[k] = v), b),
      order: () => ((ordered = true), b),
      limit: () => ((limited = true), b),
      update: (p: Record<string, unknown>) => ((mode = "update"), (patch = p), b),
      insert: (r: Omit<Row, "id">) => {
        rows.push({ id: `r${rows.length + 1}`, ...r });
        return Promise.resolve({ error: null });
      },
      maybeSingle: () => Promise.resolve({ data: run().data[0] ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve),
    };
    void limited;
    return b;
  };
  return { from } as never;
}

const base = { space_id: "s1" };

describe("upsertImportRule", () => {
  it("creates a rule with the next priority", async () => {
    const rows: Row[] = [{ id: "a", keyword: "autre", kind: "expense", category_id: "c0", priority: 4, ...base }];
    const res = await upsertImportRule(makeSupabase(rows), "s1", "u1", { keyword: " Boulangerie du coin ", category_id: "c1", kind: "expense" });
    expect(res).toEqual({ status: "created" });
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ keyword: "Boulangerie du coin", category_id: "c1", priority: 5 });
  });

  it("updates the existing rule without duplicating, ignoring case", async () => {
    const rows: Row[] = [{ id: "a", keyword: "boulangerie du coin", kind: "expense", category_id: "c0", priority: 0, ...base }];
    const res = await upsertImportRule(makeSupabase(rows), "s1", "u1", { keyword: "BOULANGERIE DU COIN", category_id: "c2", kind: "expense" });
    expect(res).toEqual({ status: "updated" });
    expect(rows).toHaveLength(1);
    expect(must(rows[0]).category_id).toBe("c2");
  });

  it("treats a different kind as a distinct rule", async () => {
    const rows: Row[] = [{ id: "a", keyword: "remboursement", kind: "expense", category_id: "c0", priority: 0, ...base }];
    const res = await upsertImportRule(makeSupabase(rows), "s1", "u1", { keyword: "remboursement", category_id: "c3", kind: "income" });
    expect(res).toEqual({ status: "created" });
    expect(rows).toHaveLength(2);
    expect(must(rows[0]).category_id).toBe("c0");
  });
});

describe("ruleFromCategoryChange", () => {
  const ok = { kind: "expense", previousCategoryId: "c0", nextCategoryId: "c1", description: "Loyer" };
  it("returns a candidate when the category changes", () => {
    expect(ruleFromCategoryChange(ok)).toEqual({ keyword: "Loyer", category_id: "c1", kind: "expense" });
  });
  it("ignores transfers", () => {
    expect(ruleFromCategoryChange({ ...ok, kind: "transfer" })).toBeNull();
  });
  it("ignores unchanged, null or absent categories", () => {
    expect(ruleFromCategoryChange({ ...ok, nextCategoryId: "c0" })).toBeNull();
    expect(ruleFromCategoryChange({ ...ok, nextCategoryId: null })).toBeNull();
    expect(ruleFromCategoryChange({ ...ok, nextCategoryId: undefined })).toBeNull();
  });
  it("ignores an empty label", () => {
    expect(ruleFromCategoryChange({ ...ok, description: "  " })).toBeNull();
  });
});
