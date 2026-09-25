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
    await expect(page.getByRole("heading", { name: "Comptes", exact: true })).toBeVisible();
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
    await page.getByRole("button", { name: /mois suivant/i }).click();
    await expect(page).toHaveURL(/\?period=\d{4}-\d{2}/);
  });
});

test.describe("Transactions", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("transactions page loads", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "Transactions", exact: true })).toBeVisible();
  });

  test("can create an expense via the type picker", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "+ Ajouter" }).click();
    await page.getByRole("menuitem", { name: "+ Dépense" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Wait for accounts to load then select the first one
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(/compte/i).selectOption({ index: 1 });
    await dialog.getByLabel(/montant/i).fill("25.50");
    await dialog.getByLabel(/description/i).fill("Test dépense E2E");
    await dialog.getByRole("button", { name: /créer|enregistrer/i }).click();
    await expect(page.getByText("Test dépense E2E")).toBeVisible({ timeout: 10000 });
  });

  test("can create a transfer via the type picker", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "+ Ajouter" }).click();
    await page.getByRole("menuitem", { name: "+ Virement" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const dialog = page.getByRole("dialog");
    const source = dialog.getByLabel(/compte source/i);
    const destination = dialog.getByLabel(/compte destination/i);
    await source.selectOption({ index: 1 });
    // Pick any destination that differs from the chosen source.
    const sourceValue = await source.inputValue();
    const destinationValues = await destination
      .locator("option")
      .evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value).filter(Boolean));
    await destination.selectOption(destinationValues.find((v) => v !== sourceValue)!);
    await dialog.getByLabel(/montant/i).fill("100");
    await dialog.getByRole("button", { name: /créer|enregistrer/i }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 });
  });

  test("can filter the list by type", async ({ page }) => {
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Virements", exact: true }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await page.getByRole("button", { name: "Toutes", exact: true }).click();
    await expect(page).toHaveURL(/\/transactions$/);
  });
});
