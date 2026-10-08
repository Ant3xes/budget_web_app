import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BudgetBar } from "@/components/dashboard/budget-bar";

function render(ratio: number, className?: string): string {
  return renderToStaticMarkup(createElement(BudgetBar, { ratio, className }));
}

/** Extrait le div de remplissage (le 2e div) : { class, style }. */
function fill(html: string): { cls: string; style: string } {
  const divs = [...html.matchAll(/<div class="([^"]*)"(?: style="([^"]*)")?/g)];
  expect(divs).toHaveLength(2);
  return { cls: divs[1][1], style: divs[1][2] ?? "" };
}

/** Pourcentage rempli, quelle que soit la façon de le dessiner (width ou translateX). */
function fillPct(html: string): number {
  const { style } = fill(html);
  const w = style.match(/width:\s*([\d.]+)%/);
  if (w) return Number(w[1]);
  const t = style.match(/translateX\(-?([\d.]+)%\)/);
  if (t) return 100 - Number(t[1]);
  throw new Error(`aucune progression lisible dans style="${style}"`);
}

describe("BudgetBar — palier de couleur selon le rythme de dépense", () => {
  it.each([
    [0, "good"],
    [0.69, "good"],
    [0.7, "warning"],
    [0.89, "warning"],
    [0.9, "serious"],
    [1, "serious"],
    [1.01, "critical"],
    [3, "critical"],
  ])("ratio %s -> palier %s", (ratio, tier) => {
    const html = render(ratio);
    expect(fill(html).cls).toContain(`bg-status-${tier}`);
    // la piste prend la teinte claire du même palier
    expect(html).toContain(`bg-status-${tier}/15`);
  });
});

describe("BudgetBar — progression affichée", () => {
  it.each([
    [0, 0],
    [0.25, 25],
    [0.5, 50],
    [1, 100],
  ])("ratio %s -> %s %% rempli", (ratio, pct) => {
    expect(fillPct(render(ratio))).toBeCloseTo(pct, 5);
  });

  it("plafonne à 100 % quand le budget est dépassé, en gardant le palier critique", () => {
    const html = render(1.8);
    expect(fillPct(html)).toBe(100);
    expect(fill(html).cls).toContain("bg-status-critical");
  });

  it("ne descend pas sous 0 % pour un ratio négatif", () => {
    expect(fillPct(render(-0.4))).toBe(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    "ratio non fini (%s) -> barre vide, palier good, jamais NaN%%",
    (ratio) => {
      const html = render(ratio);
      expect(html).not.toContain("NaN");
      expect(fillPct(html)).toBe(0);
      expect(fill(html).cls).toContain("bg-status-good");
    },
  );

  it("transmet className à la piste", () => {
    expect(render(0.5, "mt-2")).toMatch(/^<div class="[^"]*\bmt-2\b/);
  });
});

describe("BudgetBar — mouvement (skills motion / motion-design)", () => {
  it("n'anime aucune propriété de layout (width/height) : transform uniquement", () => {
    const { cls, style } = fill(render(0.5));
    expect(style).not.toMatch(/width|height/);
    expect(style).toMatch(/transform/);
    expect(cls).not.toContain("transition-all");
    expect(cls).toContain("transition-transform");
  });

  it("respecte prefers-reduced-motion", () => {
    expect(fill(render(0.5)).cls).toContain("motion-reduce:transition-none");
  });
});
