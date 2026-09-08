import { describe, expect, it } from "vitest";

import { computeTransferVolumeSeries } from "@/lib/accounts/compute-transfer-volume-series";

describe("computeTransferVolumeSeries", () => {
  it("sums the absolute amount of transfer_debit rows per month", () => {
    const points = computeTransferVolumeSeries(
      [
        { date: "2026-01-05", amount_cents: -10000 },
        { date: "2026-01-20", amount_cents: -5000 },
        { date: "2026-02-01", amount_cents: -2000 },
      ],
      2,
      new Date(),
      "2026-02",
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ month: "Jan 26", transferVolume: 15000 });
    expect(points[1]).toMatchObject({ month: "Fév 26", transferVolume: 2000 });
  });

  it("returns a zero-filled window when there are no transfers", () => {
    const points = computeTransferVolumeSeries([], 3, new Date(), "2026-06");
    expect(points).toHaveLength(3);
    expect(points.every((p) => p.transferVolume === 0)).toBe(true);
  });
});
