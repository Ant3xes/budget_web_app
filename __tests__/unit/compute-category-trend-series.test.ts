import { describe, expect, it } from "vitest";

import { computeCategoryTrendSeries } from "@/lib/accounts/compute-category-trend-series";
import { UNCATEGORIZED_CATEGORY_ID } from "@/lib/constants";

describe("computeCategoryTrendSeries", () => {
  it("buckets expense amounts per category per month", () => {
    const { points, series } = computeCategoryTrendSeries(
      [
        { date: "2026-01-05", amount_cents: -1000, categoryId: "cat-food", categoryName: "Alimentation", categoryColor: "#22c55e" },
        { date: "2026-01-10", amount_cents: -500, categoryId: "cat-food", categoryName: "Alimentation", categoryColor: "#22c55e" },
        { date: "2026-02-01", amount_cents: -2000, categoryId: "cat-transport", categoryName: "Transport", categoryColor: "#3b82f6" },
      ],
      2,
      new Date(),
      "2026-02",
    );
    expect(series.map((s) => s.name).sort()).toEqual(["Alimentation", "Transport"]);
    expect(points).toHaveLength(2);
    const jan = points.find((p) => p.month.startsWith("Jan"))!;
    expect(jan["cat-food"]).toBe(1500);
    expect(jan["cat-transport"]).toBe(0);
  });

  it("folds transactions with no category under the shared uncategorized sentinel", () => {
    const { series, points } = computeCategoryTrendSeries(
      [{ date: "2026-03-01", amount_cents: -300, categoryId: null, categoryName: null, categoryColor: null }],
      1,
      new Date(),
      "2026-03",
    );
    expect(series[0]!.key).toBe(UNCATEGORIZED_CATEGORY_ID);
    expect(points[0]![UNCATEGORIZED_CATEGORY_ID]).toBe(300);
  });

  it("folds categories beyond maxSeries into a trailing 'Autres' series", () => {
    const transactions = Array.from({ length: 7 }, (_, i) => ({
      date: "2026-01-01",
      amount_cents: -(100 * (i + 1)), // distinct totals so ranking is deterministic
      categoryId: `cat-${i}`,
      categoryName: `Cat ${i}`,
      categoryColor: null,
    }));
    const { series, points } = computeCategoryTrendSeries(transactions, 1, new Date(), "2026-01", 3);
    expect(series).toHaveLength(4); // top 3 + "Autres"
    expect(series[series.length - 1]!.key).toBe("__others__");
    // The 4 smallest categories (cat-0..cat-3) fold into "Autres": 100+200+300+400 = 1000
    expect(points[0]!.__others__).toBe(1000);
  });
});
