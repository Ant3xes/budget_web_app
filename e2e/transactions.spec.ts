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

test.describe("Accounts", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("accounts page loads", async ({ page }) => {
    await page.goto("/accounts");
    await expect(page.getByRole("heading", { name: /comptes/i })).toBeVisible();
  });

  test("can create an account", async ({ page }) => {
    await page.goto("/accounts");
    // The form is inline — no modal to open
    await page.getByLabel(/name/i).fill("Compte E2E Test");
    await page.getByLabel(/initial balance/i).fill("1000");
    await page.getByRole("button", { name: /create account/i }).click();
    await expect(page.getByText("Compte E2E Test")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Transactions", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("expenses page loads", async ({ page }) => {
    await page.goto("/expenses");
    await expect(page.getByRole("heading", { name: /dépenses/i })).toBeVisible();
  });

  test("can create an expense", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: /nouvelle dépense|ajouter/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Wait for accounts to load then select the first one
    await page.getByLabel(/compte/i).selectOption({ index: 1 });
    await page.getByLabel(/montant/i).fill("25.50");
    await page.getByLabel(/description/i).fill("Test dépense E2E");
    await page.getByRole("button", { name: /créer|enregistrer/i }).click();
    await expect(page.getByText("Test dépense E2E")).toBeVisible({ timeout: 10000 });
  });

  test("incomes page loads", async ({ page }) => {
    await page.goto("/incomes");
    await expect(page.getByRole("heading", { name: /revenus/i })).toBeVisible();
  });
});

test.describe("Transfers", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("transfers page loads", async ({ page }) => {
    await page.goto("/transfers");
    await expect(page.getByRole("heading", { name: /virements/i })).toBeVisible();
  });
});
