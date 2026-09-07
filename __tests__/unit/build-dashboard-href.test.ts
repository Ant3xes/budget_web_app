import { describe, expect, it } from "vitest";

import { buildDashboardHref } from "@/lib/dashboard/build-dashboard-href";

describe("buildDashboardHref", () => {
  it("returns the bare basePath when every param is undefined", () => {
    expect(buildDashboardHref("/dashboard", { period: undefined, accounts: undefined })).toBe("/dashboard");
  });

  it("includes only the defined params", () => {
    expect(buildDashboardHref("/dashboard", { period: "3m", accounts: undefined })).toBe("/dashboard?period=3m");
  });

  it("preserves an empty-string value instead of dropping it like undefined", () => {
    // Regression test (Dashboard & UX polish batch): `account-selector.tsx`
    // uses "" to mean "every account deselected", a state distinct from
    // "no filter" (undefined) — dropping it the same way silently turned
    // "select none" back into "select all" the moment the last account was
    // toggled off.
    expect(buildDashboardHref("/dashboard", { period: "3m", accounts: "" })).toBe("/dashboard?period=3m&accounts=");
  });

  it("percent-encodes special characters in a param value", () => {
    expect(buildDashboardHref("/dashboard", { period: "2026-03:2026-06" })).toBe(
      "/dashboard?period=2026-03%3A2026-06",
    );
  });
});
