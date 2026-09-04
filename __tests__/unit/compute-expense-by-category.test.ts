import { describe, expect, it } from "vitest";

import { computeExpenseByCategory } from "@/lib/accounts/compute-expense-by-category";

describe("computeExpenseByCategory", () => {
  const txs = [
    { date: "2026-01-10", amount_cents: -5000, categoryName: "Alimentation", categoryColor: "#22c55e" },
    { date: "2026-01-15", amount_cents: -3000, categoryName: "Alimentation", categoryColor: "#22c55e" },
    { date: "2026-02-01", amount_cents: -8000, categoryName: "Logement", categoryColor: "#3b82f6" },
    { date: "2026-03-01", amount_cents: -2000, categoryName: null, categoryColor: null },
  ];

  it("aggregates all expenses by category when no bounds", () => {
    const result = computeExpenseByCategory(txs);
    expect(result).toEqual([
      { name: "Alimentation", value: 8000, color: "#22c55e", icon: null, categoryId: null },
      { name: "Logement", value: 8000, color: "#3b82f6", icon: null, categoryId: null },
      { name: "Sans catégorie", value: 2000, color: "#94a3b8", icon: null, categoryId: null },
    ]);
  });

  it("filters by inclusive date window", () => {
    const result = computeExpenseByCategory(txs, "2026-01-01", "2026-01-31");
    expect(result).toEqual([
      { name: "Alimentation", value: 8000, color: "#22c55e", icon: null, categoryId: null },
    ]);
  });

  it("carries the category id through for drill-down links", () => {
    const result = computeExpenseByCategory([
      { date: "2026-01-10", amount_cents: -5000, categoryName: "Alimentation", categoryColor: "#22c55e", categoryId: "cat-1" },
    ]);
    expect(result).toEqual([
      { name: "Alimentation", value: 5000, color: "#22c55e", icon: null, categoryId: "cat-1" },
    ]);
  });

  it("carries the category icon through", () => {
    const result = computeExpenseByCategory([
      { date: "2026-01-10", amount_cents: -5000, categoryName: "Alimentation", categoryColor: "#22c55e", categoryIcon: "🍔" },
    ]);
    expect(result).toEqual([
      { name: "Alimentation", value: 5000, color: "#22c55e", icon: "🍔", categoryId: null },
    ]);
  });
});
