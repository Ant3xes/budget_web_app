import { describe, expect, it, vi } from "vitest";

import { runScopedQuery } from "@/lib/accounts/run-scoped-query";

describe("runScopedQuery", () => {
  it("runs the query when every id list is non-empty", async () => {
    const run = vi.fn(() => Promise.resolve({ data: [1, 2, 3] }));
    const result = await runScopedQuery([["a"], ["b", "c"]], run);
    expect(run).toHaveBeenCalledOnce();
    expect(result.data).toEqual([1, 2, 3]);
  });

  it("skips the query and resolves to an empty array when one id list is empty", async () => {
    const run = vi.fn(() => Promise.resolve({ data: [1, 2, 3] }));
    const result = await runScopedQuery([["a"], []], run);
    expect(run).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
  });

  it("skips the query when the single id list is empty", async () => {
    const run = vi.fn(() => Promise.resolve({ data: [1] }));
    const result = await runScopedQuery([[]], run);
    expect(run).not.toHaveBeenCalled();
    expect(result.data).toEqual([]);
  });
});
