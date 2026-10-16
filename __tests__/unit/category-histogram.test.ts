import { describe, expect, it } from "vitest";

import { sortCategoryHistogram, toggleHiddenId, visibleCategoryHistogram } from "@/lib/analytics/category-histogram";

const entries = [
  { id: "a", label: "Courses", value: 3000, color: "#111" },
  { id: "b", label: "Loyer", value: 9000, color: "#222" },
  { id: "c", label: "Loisirs", value: 3000, color: "#333" },
];

describe("category histogram", () => {
  it("sorts by amount desc, ties by label", () => {
    expect(sortCategoryHistogram(entries).map((e) => e.id)).toEqual(["b", "a", "c"]);
  });

  it("shows every category when nothing is hidden", () => {
    expect(visibleCategoryHistogram(entries, new Set())).toHaveLength(3);
  });

  it("removes hidden categories and keeps the order", () => {
    expect(visibleCategoryHistogram(entries, new Set(["a"])).map((e) => e.id)).toEqual(["b", "c"]);
  });

  it("toggles an id on and off without mutating the input", () => {
    const empty = new Set<string>();
    const hidden = toggleHiddenId(empty, "a");
    expect([...hidden]).toEqual(["a"]);
    expect(empty.size).toBe(0);
    expect(toggleHiddenId(hidden, "a").size).toBe(0);
  });
});
