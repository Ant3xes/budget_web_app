import { describe, expect, it, vi } from "vitest";

import { insertImportRules } from "@/lib/import/rules";
import { createChainableMock } from "@/__tests__/mocks/supabase";

type Rule = { keyword: string; kind: "expense" | "income"; priority: number };

/**
 * `insertImportRules` makes exactly 2 calls: a plain awaited SELECT (no
 * `.single()`) for the user's existing rules, then a plain awaited INSERT.
 * `createChainableMock`'s single shared result satisfies both: the SELECT
 * reads `.data` as the existing rows, the INSERT reads only `.error` from
 * the same object (its `.data` is irrelevant there).
 */
function makeSupabase(existingRules: Rule[]) {
  const queryBuilder = createChainableMock({ data: existingRules, error: null });
  return { from: vi.fn(() => queryBuilder), _queryBuilder: queryBuilder };
}

describe("insertImportRules", () => {
  it("inserts every rule with sequential priorities starting after the existing max", async () => {
    const supabase = makeSupabase([{ keyword: "netflix", kind: "expense", priority: 2 }]);
    const result = await insertImportRules(supabase as never, "user-1", [
      { keyword: "spotify", category_id: "cat-1", kind: "expense" },
      { keyword: "deezer", category_id: "cat-1", kind: "expense" },
    ]);
    expect(result).toEqual({ inserted: 2 });
    expect(supabase._queryBuilder.insert).toHaveBeenCalledWith([
      { keyword: "spotify", category_id: "cat-1", kind: "expense", user_id: "user-1", priority: 3 },
      { keyword: "deezer", category_id: "cat-1", kind: "expense", user_id: "user-1", priority: 4 },
    ]);
  });

  it("starts at priority 0 when the user has no existing rules", async () => {
    const supabase = makeSupabase([]);
    const result = await insertImportRules(supabase as never, "user-1", [
      { keyword: "spotify", category_id: "cat-1", kind: "expense" },
    ]);
    expect(result).toEqual({ inserted: 1 });
    expect(supabase._queryBuilder.insert).toHaveBeenCalledWith([
      { keyword: "spotify", category_id: "cat-1", kind: "expense", user_id: "user-1", priority: 0 },
    ]);
  });

  it("skips a rule duplicating an existing keyword (case-insensitive) for the same kind", async () => {
    const supabase = makeSupabase([{ keyword: "Netflix", kind: "expense", priority: 0 }]);
    const result = await insertImportRules(supabase as never, "user-1", [
      { keyword: "netflix", category_id: "cat-1", kind: "expense" },
    ]);
    expect(result).toEqual({ inserted: 0 });
    expect(supabase._queryBuilder.insert).not.toHaveBeenCalled();
  });

  it("skips a rule duplicating another one earlier in the same batch (the race the old sequential-insert design used to allow)", async () => {
    const supabase = makeSupabase([]);
    const result = await insertImportRules(supabase as never, "user-1", [
      { keyword: "netflix", category_id: "cat-1", kind: "expense" },
      { keyword: "NETFLIX", category_id: "cat-2", kind: "expense" },
    ]);
    expect(result).toEqual({ inserted: 1 });
    expect(supabase._queryBuilder.insert).toHaveBeenCalledWith([
      { keyword: "netflix", category_id: "cat-1", kind: "expense", user_id: "user-1", priority: 0 },
    ]);
  });

  it("skips a blank keyword after trimming without dropping the rest of the batch", async () => {
    const supabase = makeSupabase([]);
    const result = await insertImportRules(supabase as never, "user-1", [
      { keyword: "   ", category_id: "cat-1", kind: "expense" },
      { keyword: "spotify", category_id: "cat-1", kind: "expense" },
    ]);
    expect(result).toEqual({ inserted: 1 });
  });

  it("returns inserted: 0 without querying when called with an empty list", async () => {
    const supabase = makeSupabase([]);
    const result = await insertImportRules(supabase as never, "user-1", []);
    expect(result).toEqual({ inserted: 0 });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
