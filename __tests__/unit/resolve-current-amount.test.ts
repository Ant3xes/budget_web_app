import { describe, expect, it } from "vitest";

import { resolveGoalCurrentCents } from "@/lib/savings-goals/resolve-current-amount";

describe("resolveGoalCurrentCents", () => {
  it("returns the stored amount for a manual (unlinked) goal", () => {
    const result = resolveGoalCurrentCents(
      { linked_category_id: null, current_amount_cents: 15000 },
      {},
    );
    expect(result).toBe(15000);
  });

  it("returns the live category total for a linked goal", () => {
    const result = resolveGoalCurrentCents(
      { linked_category_id: "cat-1", current_amount_cents: 15000 },
      { "cat-1": 8000 },
    );
    expect(result).toBe(8000);
  });

  it("falls back to 0 for a linked goal with no matching transactions yet", () => {
    const result = resolveGoalCurrentCents(
      { linked_category_id: "cat-1", current_amount_cents: 15000 },
      {},
    );
    expect(result).toBe(0);
  });
});
