import { describe, expect, it } from "vitest";

import {
  applyCategoryToSelection,
  filterRowsByCategory,
  NO_CATEGORY_FILTER,
} from "@/lib/import/category-filter";

const rows = [{ rowId: "a" }, { rowId: "b" }, { rowId: "c" }, { rowId: "d" }];
const cats: Record<string, string> = { a: "food", b: "", c: "food", d: "fun" };

describe("filterRowsByCategory", () => {
  it("returns all rows when no filter is set", () => {
    expect(filterRowsByCategory(rows, cats, "")).toEqual(rows);
  });
  it("keeps rows whose category matches", () => {
    expect(filterRowsByCategory(rows, cats, "food").map((r) => r.rowId)).toEqual(["a", "c"]);
  });
  it("keeps uncategorised rows with the no-category filter", () => {
    expect(filterRowsByCategory(rows, cats, NO_CATEGORY_FILTER).map((r) => r.rowId)).toEqual(["b"]);
  });
  it("treats a missing map entry as uncategorised", () => {
    expect(filterRowsByCategory(rows, {}, NO_CATEGORY_FILTER)).toHaveLength(4);
  });
});

describe("applyCategoryToSelection", () => {
  it("only changes checked rows that are visible", () => {
    const visible = [{ rowId: "a" }, { rowId: "c" }];
    const checked = { a: true, b: true, c: false, d: true };
    const next = applyCategoryToSelection(cats, visible, checked, "x");
    expect(next).toEqual({ a: "x", b: "", c: "food", d: "fun" });
  });
  it("does not mutate the input", () => {
    const input = { a: "" };
    applyCategoryToSelection(input, [{ rowId: "a" }], { a: true }, "x");
    expect(input).toEqual({ a: "" });
  });
  it("is a no-op without a category", () => {
    expect(applyCategoryToSelection(cats, rows, { a: true }, "")).toBe(cats);
  });
});
