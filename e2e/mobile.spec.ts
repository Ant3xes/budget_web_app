import { expect, test } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@budget.local";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Password1234!";

// Runs on the "mobile" Playwright project (Pixel 7). On the desktop project
// the bottom nav is hidden, so these checks are skipped there.
test.describe("Mobile navigation", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only");
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/mot de passe|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
  });

  test("bottom nav navigates between sections", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Navigation principale" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Transactions" }).click();
    await expect(page).toHaveURL(/\/transactions/);
    await expect(nav.getByRole("link", { name: "Transactions" })).toHaveAttribute("aria-current", "page");
  });

  test("'Plus' opens the secondary menu", async ({ page }) => {
    await page.getByRole("button", { name: "Plus" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
