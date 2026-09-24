import { describe, expect, it } from "vitest";

import { nextQuery, safeNext } from "@/lib/auth/safe-next";

describe("safeNext", () => {
  it("accepts same-site paths", () => {
    expect(safeNext("/invite/abc")).toBe("/invite/abc");
    expect(safeNext("/dashboard?tab=1")).toBe("/dashboard?tab=1");
  });

  it.each([
    ["absolute URL", "https://evil.example"],
    ["protocol-relative URL", "//evil.example"],
    ["backslash trick", "/\\evil.example"],
    ["no leading slash", "dashboard"],
    ["control characters", "/a\nb"],
    ["empty", ""],
  ])("rejects %s", (_label, value) => {
    expect(safeNext(value)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext(null)).toBeNull();
    expect(safeNext(42)).toBeNull();
  });
});

describe("nextQuery", () => {
  it("encodes the path", () => {
    expect(nextQuery("/invite/a b")).toBe("?next=%2Finvite%2Fa%20b");
    expect(nextQuery("/x", "&")).toBe("&next=%2Fx");
  });

  it("is empty without a next", () => {
    expect(nextQuery(null)).toBe("");
    expect(nextQuery(undefined)).toBe("");
  });
});
