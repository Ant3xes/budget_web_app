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

  test("wrong password shows a generic message announced as an alert", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill(TEST_EMAIL);
    await page.getByLabel(/mot de passe|password/i).fill("WrongPassword!");
    await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
    await expect(page).toHaveURL(/message=invalidCredentials/);
    // Next.js adds its own role="alert" (route announcer): target the message itself.
    await expect(page.locator('p[role="alert"]')).toContainText(/invalide|invalid/i);
    // The auth library's own wording is never reflected into the page.
    await expect(page.getByText("Invalid login credentials")).toHaveCount(0);
  });

  test("a crafted ?message= link cannot display arbitrary text", async ({ page }) => {
    const spoof = "Votre compte est suspendu, appelez le 06 00 00 00 00";
    await page.goto(`/login?message=${encodeURIComponent(spoof)}`);
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByText(spoof)).toHaveCount(0);
  });

  test("login fields expose their purpose to browsers and assistive tech (WCAG 1.3.5)", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel(/email/i)).toHaveAttribute("autocomplete", "email");
    await expect(page.getByLabel(/mot de passe|password/i)).toHaveAttribute("autocomplete", "current-password");
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

    // Logout lives in the sidebar's user menu.
    await page.getByRole("button", { name: TEST_EMAIL }).click();
    await page.getByRole("button", { name: /déconnexion|logout|se déconnecter/i }).click();
    await expect(page).toHaveURL(/login/);
  });
});
