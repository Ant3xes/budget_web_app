import { expect, test } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@budget.local";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Password1234!";

test.describe("Auth", () => {
  test("login with valid credentials redirects to dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/mot de passe|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);
  });

  test("login with wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/mot de passe|password/i).fill("WrongPassword!");
    await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
    await expect(page.getByText(/invalide|incorrect|invalid/i)).toBeVisible();
  });

  test("unauthenticated access to dashboard redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });

  test("logout redirects to login", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/mot de passe|password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
    await expect(page).toHaveURL(/dashboard/);

    await page.getByRole("button", { name: /déconnexion|logout|se déconnecter/i }).click();
    await expect(page).toHaveURL(/login/);
  });
});
