import { describe, expect, it } from "vitest";

import {
  parsePeriodParam,
  periodBounds,
  periodToParam,
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
