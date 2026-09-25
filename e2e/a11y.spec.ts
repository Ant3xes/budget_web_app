import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@budget.local";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Password1234!";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/mot de passe|password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

// Guards against a silently ignored theme switch (which would make the "dark"
// scan a second light scan).
async function expectTheme(page: Page, theme: "light" | "dark") {
  await expect(page.locator("html")).toHaveClass(theme === "dark" ? /(^|\s)dark(\s|$)/ : /^((?!\bdark\b).)*$/);
}

// Rules that are known design debt (tracked separately): still reported in the
// attached report, but they don't fail the build yet. Remove an id from this
// list once it's fixed so it can't regress.
const KNOWN_DEBT = new Set<string>();

// Only blocks on violations that really hurt users; minor/moderate ones and
// known debt are reported in the test output (attached below) without failing.
async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    // WCAG 2.5.3 "Label in Name": experimental in axe, so off by default.
    // Lighthouse flagged it (bank tiles, user menu), keep it fixed.
    .options({ rules: { "label-content-name-mismatch": { enabled: true } } })
    .analyze();

  const blocking = results.violations.filter(
    (v) => (v.impact === "serious" || v.impact === "critical") && !KNOWN_DEBT.has(v.id),
  );
  // One line per rule, then one line per offending element (with the measured
  // colors/ratio for color-contrast) so a failure says exactly what to fix.
  const summary = (list: typeof results.violations) =>
    list
      .map((v) => {
        const nodes = v.nodes
          .map((n) => {
            const d = (n.any[0]?.data ?? {}) as { fgColor?: string; bgColor?: string; contrastRatio?: number };
            const colors = d.fgColor ? ` [${d.fgColor} on ${d.bgColor}, ${d.contrastRatio}:1]` : "";
            return `    - ${n.html.slice(0, 120)}${colors}`;
          })
          .join("\n");
        return `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node(s)) ${v.helpUrl}\n${nodes}`;
      })
      .join("\n");

  await test.info().attach("axe-all-violations", {
    body: summary(results.violations) || "none",
    contentType: "text/plain",
  });
  expect(blocking, `Accessibility violations:\n${summary(blocking)}`).toEqual([]);
}

const PAGES = [
  { name: "dashboard", path: "/dashboard" },
  { name: "transactions", path: "/transactions" },
  { name: "accounts", path: "/accounts" },
  { name: "budget", path: "/budget" },
  { name: "goals", path: "/goals" },
  { name: "fixed charges", path: "/fixed-charges" },
  { name: "analytics", path: "/analytics" },
  // /settings redirects to its first sub-page.
  { name: "settings", path: "/settings/categories" },
];

// The theme is read from localStorage before first paint (see app/layout.tsx),
// so setting it in an init script makes every page load in that theme.
// Dark mode is only scanned on the desktop project to keep the CI short.
for (const theme of ["light", "dark"] as const) {
  test.describe(`Accessibility (axe) — ${theme}`, () => {
    test.beforeEach(async ({ page }, testInfo) => {
      test.skip(theme === "dark" && testInfo.project.name !== "chromium", "dark mode: desktop project only");
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
    });

    test("login page", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expectTheme(page, theme);
      await expectNoSeriousViolations(page);
    });

    for (const { name, path } of PAGES) {
      test(`${name} page`, async ({ page }) => {
        await login(page);
        await page.goto(path);
        // Some pages add a query string (e.g. /budget?month=2026-09).
        await expect(page).toHaveURL(new RegExp(`${path}(\\?.*)?$`));
        // Page content rendered (not a loading skeleton) before scanning.
        await expect(page.getByRole("heading").first()).toBeVisible();
        await expectTheme(page, theme);
        await expectNoSeriousViolations(page);
      });
    }
  });
}
