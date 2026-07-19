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
    await page.getByRole("button", { name: /nouveau compte/i }).click();
    await page.getByLabel(/^nom$/i).fill("Compte E2E Test");
    await page.getByLabel(/solde initial/i).fill("1000");
    await page.getByRole("button", { name: /créer le compte/i }).click();
    await expect(page.getByText("Compte E2E Test")).toBeVisible({ timeout: 10000 });
  });

  test("account card opens detail with chart and month lists", async ({ page }) => {
    await page.goto("/accounts");
    const card = page.locator("a[href^='/accounts/']").first();
    await expect(card).toBeVisible({ timeout: 10000 });
    await card.click();
    await expect(page).toHaveURL(/\/accounts\/[0-9a-f-]+/i);
    await expect(page.getByText(/évolution du solde/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /^dépenses$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^revenus$/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^virements$/i })).toBeVisible();
    await page.getByRole("button", { name: "→" }).click();
    await expect(page).toHaveURL(/\?month=\d{4}-\d{2}/);
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
