import { describe, expect, it } from "vitest";
import { must } from "@/__tests__/helpers/must";

describe("must", () => {
  it("returns the existing value without changing its identity", () => {
    const value = { id: "fixture" };
    expect(must(value)).toBe(value);
  });

  it("accepts falsy values and null", () => {
    expect(must(0)).toBe(0);
    expect(must(false)).toBe(false);
    expect(must("")).toBe("");
    expect(must(null)).toBeNull();
  });

  it("fails immediately for a missing fixture entry", () => {
    expect(() => must(undefined)).toThrow("Expected a defined test value");
  });
});
