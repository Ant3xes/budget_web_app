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
});

describe("periodToParam", () => {
  it("serializes month and preset", () => {
    expect(periodToParam({ type: "month", month: "2026-07" })).toBe("2026-07");
    expect(periodToParam({ type: "preset", value: "6m" })).toBe("6m");
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
});
