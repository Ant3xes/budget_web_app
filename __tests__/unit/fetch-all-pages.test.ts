import { describe, expect, it, vi } from "vitest";

import { fetchAllPages } from "@/lib/shared-expenses/fetch-all-pages";

const source = Array.from({ length: 25 }, (_, index) => ({ id: index }));
const pageOf = (from: number, to: number) => Promise.resolve({ data: source.slice(from, to + 1), error: null });

describe("fetchAllPages", () => {
  it("reads every row across several pages", async () => {
    const fetchPage = vi.fn(pageOf);
    expect(await fetchAllPages(fetchPage, 10)).toEqual(source);
    // 10 + 10 + 5: the short last page ends the walk.
    expect(fetchPage.mock.calls).toEqual([
      [0, 9],
      [10, 19],
      [20, 29],
    ]);
  });

  it("asks for one more page when the total is an exact multiple of the page size", async () => {
    const fetchPage = vi.fn(pageOf);
    expect(await fetchAllPages(fetchPage, 5)).toHaveLength(25);
    expect(fetchPage).toHaveBeenCalledTimes(6);
  });

  it("returns an empty list for an empty table", async () => {
    expect(await fetchAllPages(() => Promise.resolve({ data: [], error: null }), 10)).toEqual([]);
    expect(await fetchAllPages(() => Promise.resolve({ data: null, error: null }), 10)).toEqual([]);
  });

  it("fails loudly instead of returning a partial (wrong) balance", async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ data: source.slice(0, 10), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(fetchAllPages(fetchPage, 10)).rejects.toThrow("boom");
  });
});
