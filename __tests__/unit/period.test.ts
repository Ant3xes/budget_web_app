import { describe, expect, it } from "vitest";

import {
  parsePeriodParam,
  periodBounds,
  periodToParam,
  periodLabel,
  floorMonthWindow,
} from "@/lib/dates/period";

describe("parsePeriodParam", () => {
  const now = new Date(2026, 6, 20); // July 20, 2026

  it("defaults to current month", () => {
    expect(parsePeriodParam(undefined, now)).toEqual({ type: "month", month: "2026-07" });
  });

  it("parses a specific month", () => {
    expect(parsePeriodParam("2026-03", now)).toEqual({ type: "month", month: "2026-03" });
  });

  it("maps 1m preset to current month", () => {
    expect(parsePeriodParam("1m", now)).toEqual({ type: "month", month: "2026-07" });
  });

  it("parses other presets", () => {
    expect(parsePeriodParam("3m", now)).toEqual({ type: "preset", value: "3m" });
    expect(parsePeriodParam("tout", now)).toEqual({ type: "preset", value: "tout" });
  });

  it("parses a custom month range", () => {
    expect(parsePeriodParam("2026-03:2026-06", now)).toEqual({ type: "range", from: "2026-03", to: "2026-06" });
  });

  it("falls back to current month for a malformed range", () => {
    expect(parsePeriodParam("2026-06:2026-03", now)).toEqual({ type: "month", month: "2026-07" }); // from after to
    expect(parsePeriodParam("2026-03:2026-06:2026-09", now)).toEqual({ type: "month", month: "2026-07" }); // 3 parts
    expect(parsePeriodParam("not-a-range", now)).toEqual({ type: "month", month: "2026-07" });
  });
});

describe("periodBounds", () => {
  const now = new Date(2026, 6, 20); // July 20, 2026

  it("bounds a specific past month to its full calendar month", () => {
    expect(periodBounds({ type: "month", month: "2026-03" }, { now })).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
      monthCount: 1,
    });
  });

  it("caps the current month at today", () => {
    expect(periodBounds({ type: "month", month: "2026-07" }, { now })).toEqual({
      from: "2026-07-01",
      to: "2026-07-20",
      monthCount: 1,
    });
  });

  it("bounds a multi-month preset", () => {
    expect(periodBounds({ type: "preset", value: "3m" }, { now })).toEqual({
      from: "2026-05-01",
      to: "2026-07-20",
      monthCount: 3,
    });
  });

  it("bounds tout from earliest date", () => {
    expect(
      periodBounds(
        { type: "preset", value: "tout" },
        { now, earliestDate: "2024-01-15" },
      ),
    ).toEqual({
      from: "2024-01-15",
      to: "2026-07-20",
      monthCount: null,
    });
  });

  it("bounds a past month range to its full calendar span", () => {
    expect(periodBounds({ type: "range", from: "2026-03", to: "2026-05" }, { now })).toEqual({
      from: "2026-03-01",
      to: "2026-05-31",
      monthCount: 3,
    });
  });

  it("caps a range including the current month at today", () => {
    expect(periodBounds({ type: "range", from: "2026-05", to: "2026-07" }, { now })).toEqual({
      from: "2026-05-01",
      to: "2026-07-20",
      monthCount: 3,
    });
  });

  it("computes monthCount inclusively for a single-month range", () => {
    expect(periodBounds({ type: "range", from: "2026-03", to: "2026-03" }, { now })).toEqual({
      from: "2026-03-01",
      to: "2026-03-31",
      monthCount: 1,
    });
  });
});

describe("periodToParam", () => {
  it("serializes month and preset", () => {
    expect(periodToParam({ type: "month", month: "2026-07" })).toBe("2026-07");
    expect(periodToParam({ type: "preset", value: "6m" })).toBe("6m");
  });

  it("serializes a range as colon-separated months", () => {
    expect(periodToParam({ type: "range", from: "2026-03", to: "2026-06" })).toBe("2026-03:2026-06");
  });
});

describe("periodLabel", () => {
  const now = new Date(2026, 6, 20); // July 20, 2026

  it("labels the current month as 'ce mois'", () => {
    expect(periodLabel({ type: "month", month: "2026-07" }, now)).toBe("ce mois");
  });

  it("labels an arbitrary past month explicitly", () => {
    expect(periodLabel({ type: "month", month: "2026-03" }, now)).toBe("mars 2026");
  });

  it("lowercases a preset's label", () => {
    expect(periodLabel({ type: "preset", value: "3m" }, now)).toBe("3 mois");
    expect(periodLabel({ type: "preset", value: "tout" }, now)).toBe("tout");
  });

  it("labels a multi-month range with an en dash between the two months", () => {
    expect(periodLabel({ type: "range", from: "2026-03", to: "2026-06" }, now)).toBe("mars 2026 – juin 2026");
  });

  it("labels a single-month range like the equivalent month case", () => {
    expect(periodLabel({ type: "range", from: "2026-03", to: "2026-03" }, now)).toBe("mars 2026");
    expect(periodLabel({ type: "range", from: "2026-07", to: "2026-07" }, now)).toBe("ce mois");
  });
});

describe("floorMonthWindow", () => {
  const now = new Date(2026, 6, 20); // July 20, 2026

  it("widens a narrower window up to the minimum", () => {
    const { from: periodFrom, monthCount } = periodBounds({ type: "month", month: "2026-07" }, { now });
    expect(floorMonthWindow(periodFrom, monthCount, 6, now)).toEqual({
      from: "2026-02-01",
      monthCount: 6,
      isFloored: true,
    });
  });

  it("leaves a window already at or above the minimum untouched", () => {
    const { from: periodFrom, monthCount } = periodBounds({ type: "preset", value: "1a" }, { now });
    expect(floorMonthWindow(periodFrom, monthCount, 6, now)).toEqual({
      from: periodFrom,
      monthCount: 12,
      isFloored: false,
    });
  });

  it("never floors 'tout' (monthCount null)", () => {
    const { from: periodFrom, monthCount } = periodBounds(
      { type: "preset", value: "tout" },
      { now, earliestDate: "2024-01-15" },
    );
    expect(floorMonthWindow(periodFrom, monthCount, 6, now)).toEqual({
      from: "2024-01-15",
      monthCount: null,
      isFloored: false,
    });
  });

  it("widens a past custom range anchored on its own endMonth, not on now's month", () => {
    // Regression: a narrow past "Personnalisé" range (mars–mai) while today
    // is juillet must widen backwards from mai, not from juillet — otherwise
    // the trend chart would show months unrelated to the selected range.
    const { from: periodFrom, monthCount } = periodBounds(
      { type: "range", from: "2026-03", to: "2026-05" },
      { now },
    );
    expect(floorMonthWindow(periodFrom, monthCount, 6, now, "2026-05")).toEqual({
      from: "2025-12-01",
      monthCount: 6,
      isFloored: true,
    });
  });
});
