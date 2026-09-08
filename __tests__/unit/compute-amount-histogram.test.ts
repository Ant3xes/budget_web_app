import { describe, expect, it } from "vitest";

import { computeAmountHistogram } from "@/lib/accounts/compute-amount-histogram";

describe("computeAmountHistogram", () => {
  it("buckets amounts (absolute value) into fixed euro ranges", () => {
    const buckets = computeAmountHistogram([
      { amount_cents: -500 }, // 5€ -> 0-10
      { amount_cents: -1500 }, // 15€ -> 10-25
      { amount_cents: -30000 }, // 300€ -> 250+
      { amount_cents: 900 }, // income row: 9€, still bucketed by absolute value -> 0-10
    ]);
    const byLabel = Object.fromEntries(buckets.map((b) => [b.label, b.count]));
    expect(byLabel["0–10€"]).toBe(2);
    expect(byLabel["10–25€"]).toBe(1);
    expect(byLabel["250€+"]).toBe(1);
    expect(byLabel["25–50€"]).toBe(0);
  });

  it("treats a bucket edge as belonging to the next (higher) bucket", () => {
    const buckets = computeAmountHistogram([{ amount_cents: -1000 }]); // exactly 10€
    const byLabel = Object.fromEntries(buckets.map((b) => [b.label, b.count]));
    expect(byLabel["10–25€"]).toBe(1);
    expect(byLabel["0–10€"]).toBe(0);
  });

  it("returns all 6 buckets even when empty", () => {
    expect(computeAmountHistogram([])).toHaveLength(6);
  });
});
