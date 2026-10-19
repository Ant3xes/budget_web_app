import { describe, expect, it } from "vitest";

import { runScopedQuery } from "@/lib/accounts/run-scoped-query";
import { SupabaseQueryError, unwrap } from "@/lib/supabase/unwrap";

describe("unwrap", () => {
  it("returns the data of a successful response", () => {
    expect(unwrap({ data: [1, 2], error: null })).toEqual([1, 2]);
  });

  it("returns null data as is (callers decide the empty value)", () => {
    expect(unwrap({ data: null, error: null })).toBeNull();
    expect(unwrap({ data: [1] })).toEqual([1]);
  });

  it("throws a SupabaseQueryError carrying message and code when error is set", () => {
    const failing = { data: null, error: { message: "permission denied", code: "42501" } };
    expect(() => unwrap(failing)).toThrow(SupabaseQueryError);
    expect(() => unwrap(failing)).toThrow("permission denied");
    try {
      unwrap(failing);
    } catch (e) {
      expect((e as SupabaseQueryError).code).toBe("42501");
    }
  });

  it("surfaces the error of a scoped query instead of an empty list", async () => {
    const res = await runScopedQuery<number>([["a"]], () => Promise.resolve({ data: null, error: { message: "boom" } }));
    expect(() => unwrap(res)).toThrow("boom");
  });

  it("a skipped scoped query unwraps to an empty list", async () => {
    const res = await runScopedQuery<number>([[]], () => Promise.reject(new Error("must not run")));
    expect(unwrap(res)).toEqual([]);
    expect(res.error).toBeNull();
  });
});
