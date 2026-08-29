import { describe, expect, it } from "vitest";

import { monthBounds } from "@/lib/dates/month-bounds";

describe("monthBounds", () => {
  it("returns inclusive UTC bounds for 31-day months", () => {
    expect(monthBounds("2026-07")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(monthBounds("2026-01")).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("returns inclusive UTC bounds for 30-day months", () => {
    expect(monthBounds("2026-06")).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });

  it("handles February in a non-leap year", () => {
    expect(monthBounds("2025-02")).toEqual({ from: "2025-02-01", to: "2025-02-28" });
  });

  it("handles February in a leap year", () => {
    expect(monthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
});
