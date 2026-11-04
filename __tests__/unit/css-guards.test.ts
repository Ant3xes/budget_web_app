import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global CSS guards", () => {
  it("does not set a root scroll-padding-bottom", () => {
    // A fixed bottom padding larger than nothing but smaller than the fixed
    // cookie banner / bottom nav makes scrollIntoView park focused elements
    // underneath them: Playwright's click on the pagination button then times
    // out (regression seen in CI on e2e/transactions.spec.ts). The banner's
    // height varies between mobile and desktop, so no single value is right.
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).not.toMatch(/scroll-padding-bottom/);
  });
});
