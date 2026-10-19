import { describe, expect, it } from "vitest";

import { progressFillTransform } from "@/lib/dashboard/progress-fill";

describe("progressFillTransform", () => {
  it.each([
    [0, "translateX(-100%)"],
    [50, "translateX(-50%)"],
    [100, "translateX(0%)"],
  ])("%s %% -> %s", (pct, expected) => {
    expect(progressFillTransform(pct)).toBe(expected);
  });

  it("plafonne à 0-100 %", () => {
    expect(progressFillTransform(250)).toBe("translateX(0%)");
    expect(progressFillTransform(-30)).toBe("translateX(-100%)");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "valeur non finie (%s) -> barre vide",
    (pct) => {
      expect(progressFillTransform(pct)).toBe("translateX(-100%)");
    },
  );

  it("n'émet jamais de notation scientifique ni de -0 (CSS invalide ou illisible)", () => {
    const awkward = [0.9999999999999999, 1e-9, 1 / 3, 2 / 3, 0.1 + 0.2, 99.99999999999999, 1e-300];
    for (const p of awkward) {
      const out = progressFillTransform(p);
      expect(out, `p=${p}`).not.toMatch(/e[-+]/i);
      expect(out, `p=${p}`).not.toContain("-0%");
      expect(out, `p=${p}`).toMatch(/^translateX\(-?\d+(\.\d{1,2})?%\)$/);
    }
  });

  it("balayage 0..100 par pas de 0,07 : toujours valide et monotone", () => {
    let prevShown = -1;
    for (let p = 0; p <= 100; p += 0.07) {
      const out = progressFillTransform(p);
      expect(out).toMatch(/^translateX\(-?\d+(\.\d{1,2})?%\)$/);
      const shown = 100 + Number(out.match(/translateX\((-?[\d.]+)%\)/)![1]);
      expect(shown).toBeGreaterThanOrEqual(prevShown);
      prevShown = shown;
    }
  });
});
