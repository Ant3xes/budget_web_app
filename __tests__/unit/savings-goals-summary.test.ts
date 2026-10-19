import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/locale-provider", () => ({
  useLocale: () => ({ locale: "fr", setLocale: () => {}, t: (k: string) => k }),
}));

import { SavingsGoalsSummary } from "@/components/dashboard/savings-goals-summary";

const goal = (over: Partial<Parameters<typeof SavingsGoalsSummary>[0]["goals"][number]> = {}) => ({
  id: "g1",
  name: "Vacances",
  icon: null,
  color: null,
  currentCents: 5000,
  targetCents: 10000,
  ...over,
});

const render = (goals: ReturnType<typeof goal>[]) => renderToStaticMarkup(createElement(SavingsGoalsSummary, { goals }));

/** Pour chaque objectif : { cls, style } du div de remplissage. */
function fills(html: string) {
  return [...html.matchAll(/<div class="([^"]*transition-transform[^"]*)" style="([^"]*)"/g)].map((m) => ({
    cls: m[1],
    style: m[2],
  }));
}

describe("SavingsGoalsSummary — barre de progression", () => {
  it("ne rend rien sans objectif", () => {
    expect(render([])).toBe("");
  });

  it("anime transform (pas width) et respecte reduced-motion", () => {
    const [f] = fills(render([goal()]));
    expect(f).toBeDefined();
    expect(f.style).toContain("transform:translateX(-50%)");
    expect(f.style).not.toMatch(/width/);
    expect(f.cls).not.toContain("transition-all");
    expect(f.cls).toContain("motion-reduce:transition-none");
  });

  it("garde le libellé en % et la couleur propre à l'objectif", () => {
    const html = render([goal({ color: "#ff0000" })]);
    expect(html).toContain("(50%)");
    expect(fills(html)[0].style).toContain("background-color:#ff0000");
  });

  it("retombe sur --status-good sans couleur", () => {
    expect(fills(render([goal()]))[0].style).toContain("var(--status-good)");
  });

  it.each([
    [{ currentCents: 0 }, "translateX(-100%)", "(0%)"],
    [{ currentCents: 10000 }, "translateX(0%)", "(100%)"],
    [{ currentCents: 99999 }, "translateX(0%)", "(100%)"],
    [{ targetCents: 0 }, "translateX(-100%)", "(0%)"],
    [{ currentCents: 1, targetCents: 3 }, "translateX(-67%)", "(33%)"],
  ])("cas limite %j", (over, transform, label) => {
    const html = render([goal(over)]);
    expect(fills(html)[0].style).toContain(transform);
    expect(html).toContain(label);
  });

  it("un montant non fini ne casse pas le style de la barre (le texte, lui, relève de formatEuros)", () => {
    const html = render([goal({ currentCents: Number.NaN }), goal({ id: "g2", targetCents: Number.NaN })]);
    const styles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
    expect(styles.length).toBeGreaterThanOrEqual(2);
    for (const st of styles) expect(st).not.toMatch(/NaN|e-\d/);
  });

  it("une barre par objectif, dans l'ordre", () => {
    const html = render([goal({ id: "a", name: "Alpha", currentCents: 2500 }), goal({ id: "b", name: "Beta", currentCents: 7500 })]);
    const f = fills(html);
    expect(f.map((x) => x.style.match(/translateX\((-?[\d.]+)%\)/)![1])).toEqual(["-75", "-25"]);
    expect(html.indexOf("Alpha")).toBeLessThan(html.indexOf("Beta"));
  });
});
