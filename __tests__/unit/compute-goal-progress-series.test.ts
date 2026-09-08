import { describe, expect, it } from "vitest";

import { computeGoalProgressSeries } from "@/lib/savings-goals/compute-goal-progress-series";

describe("computeGoalProgressSeries", () => {
  it("accumulates a linked goal's category spend cumulatively month over month", () => {
    const { points, series } = computeGoalProgressSeries(
      [
        { date: "2026-01-10", category_id: "cat-holiday", amount_cents: 10000 },
        { date: "2026-02-05", category_id: "cat-holiday", amount_cents: 5000 },
      ],
      [{ id: "goal-1", name: "Vacances", linked_category_id: "cat-holiday", color: "#3b82f6" }],
      2,
      new Date(),
      "2026-02",
    );
    expect(series).toEqual([{ key: "goal-1", name: "Vacances", color: "#3b82f6" }]);
    expect(points.map((p) => p["goal-1"])).toEqual([10000, 15000]);
  });

  it("excludes goals with no linked category (no transaction history to derive a series from)", () => {
    const { points, series } = computeGoalProgressSeries(
      [],
      [{ id: "goal-manual", name: "Fonds d'urgence", linked_category_id: null, color: null }],
      3,
      new Date(),
      "2026-06",
    );
    expect(series).toEqual([]);
    expect(points).toEqual([]);
  });

  it("keeps two linked goals' running totals independent", () => {
    const { points } = computeGoalProgressSeries(
      [
        { date: "2026-01-01", category_id: "cat-a", amount_cents: 1000 },
        { date: "2026-01-01", category_id: "cat-b", amount_cents: 2000 },
      ],
      [
        { id: "goal-a", name: "A", linked_category_id: "cat-a", color: null },
        { id: "goal-b", name: "B", linked_category_id: "cat-b", color: null },
      ],
      1,
      new Date(),
      "2026-01",
    );
    expect(points[0]).toMatchObject({ "goal-a": 1000, "goal-b": 2000 });
  });
});
