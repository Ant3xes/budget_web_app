import { describe, expect, it } from "vitest";

import { advanceOnePeriod, advanceWhile } from "@/lib/fixed-charges/due-date";

describe("advanceOnePeriod", () => {
  it("advances a monthly charge by exactly one month", () => {
    expect(advanceOnePeriod("2026-03-15", "monthly")).toBe("2026-04-15");
  });

  it("advances a quarterly charge by exactly three months", () => {
    expect(advanceOnePeriod("2026-01-10", "quarterly")).toBe("2026-04-10");
  });

  it("advances a yearly charge by exactly one year", () => {
    expect(advanceOnePeriod("2026-06-01", "yearly")).toBe("2027-06-01");
  });

  it("rolls over year boundaries for monthly charges", () => {
    expect(advanceOnePeriod("2026-12-20", "monthly")).toBe("2027-01-20");
  });

  it("clamps a month-end date into a shorter month (JS Date's own rollover)", () => {
    // Jan 31 + 1 month has no Feb 31 — JS rolls it into early March, matching
    // the pre-existing advanceDueDate loop's behavior (unchanged by this
    // extraction).
    expect(advanceOnePeriod("2026-01-31", "monthly")).toBe("2026-03-03");
  });
});

describe("advanceWhile", () => {
  it("returns the input unchanged when the predicate is already false (not overdue)", () => {
    expect(advanceWhile("2026-09-15", "monthly", (d) => d < "2026-09-01")).toBe("2026-09-15");
  });

  it("catches up a monthly charge overdue by several periods (GET /api/fixed-charges's use: stop once not < today)", () => {
    expect(advanceWhile("2026-01-15", "monthly", (d) => d < "2026-04-10")).toBe("2026-04-15");
  });

  it("supports a strictly-forward stop condition (POST .../pay's use: stop once strictly after today, treating 'equal to today' as still needing to advance)", () => {
    // A charge whose (already-advanced-once) next occurrence lands exactly
    // on "today" must still move forward — the pay route never wants a
    // freshly-paid charge to read as due again today.
    expect(advanceWhile("2026-02-15", "monthly", (d) => d <= "2026-04-15")).toBe("2026-05-15");
  });
});
