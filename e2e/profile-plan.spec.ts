import { expect, test } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@budget.local";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Password1234!";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/mot de passe|password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.describe("Profile & plan", () => {
  test("profile: update display name and persist after reload", async ({ page }) => {
    await login(page);
    await page.goto("/settings/profile");

    const name = `Test User ${Date.now()}`;
    const input = page.getByTestId("profile-full-name");
    await expect(input).toBeVisible();
    await input.fill(name);
    await page.getByRole("button", { name: /^Enregistrer$/i }).click();
    await expect(page.getByText(/Nom mis à jour/i)).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("profile-full-name")).toHaveValue(name);
  });

  test("plan page is public and shows phases", async ({ page }) => {
    await page.goto("/plan");
    await expect(page.getByRole("heading", { name: /roadmap/i })).toBeVisible();
    await expect(page.getByText(/Phase 1/i)).toBeVisible();
    await expect(page.getByText(/Phase 4/i)).toBeVisible();
  });
});
