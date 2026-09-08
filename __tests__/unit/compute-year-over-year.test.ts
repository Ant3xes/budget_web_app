import { describe, expect, it } from "vitest";

import { computeYearOverYear } from "@/lib/accounts/compute-year-over-year";

describe("computeYearOverYear", () => {
  it("pairs each current month with the same calendar month a year earlier", () => {
    const points = computeYearOverYear(
      [
        { date: "2026-03-05", kind: "expense", amount_cents: -10000 },
        { date: "2025-03-10", kind: "expense", amount_cents: -8000 },
        { date: "2026-03-01", kind: "income", amount_cents: 300000 }, // wrong metric, ignored
      ],
      1,
      new Date(),
      "2026-03",
      "expense",
    );
    expect(points).toEqual([{ key: "2026-03", month: "Mar 26", current: 10000, previous: 8000 }]);
  });

  it("defaults missing months to 0 rather than omitting them", () => {
    const points = computeYearOverYear([], 2, new Date(), "2026-02", "expense");
    expect(points).toHaveLength(2);
    expect(points.every((p) => p.current === 0 && p.previous === 0)).toBe(true);
  });
});
