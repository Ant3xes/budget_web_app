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

// Rules that are known design debt (tracked separately): still reported in the
// attached report, but they don't fail the build yet. Remove an id from this
// list once it's fixed so it can't regress.
const KNOWN_DEBT = new Set(["color-contrast"]);

// Only blocks on violations that really hurt users; minor/moderate ones and
// known debt are reported in the test output (attached below) without failing.
async function expectNoSeriousViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

  const blocking = results.violations.filter(
    (v) => (v.impact === "serious" || v.impact === "critical") && !KNOWN_DEBT.has(v.id),
  );
  const summary = (list: typeof results.violations) =>
    list.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length} node(s)) ${v.helpUrl}`).join("\n");

  await test.info().attach("axe-all-violations", {
    body: summary(results.violations) || "none",
    contentType: "text/plain",
  });
  expect(blocking, `Accessibility violations:\n${summary(blocking)}`).toEqual([]);
}

test.describe("Accessibility (axe)", () => {
  test("login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expectNoSeriousViolations(page);
  });

  for (const { name, path } of [
    { name: "dashboard", path: "/dashboard" },
    { name: "transactions", path: "/transactions" },
    { name: "settings", path: "/settings" },
  ]) {
    test(`${name} page`, async ({ page }) => {
      await login(page);
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      // Page content rendered (not a loading skeleton) before scanning.
      await expect(page.getByRole("heading").first()).toBeVisible();
      await expectNoSeriousViolations(page);
    });
  }
});
