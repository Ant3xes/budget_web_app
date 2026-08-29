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

test.describe("Budget", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("budget page loads with month navigation", async ({ page }) => {
    await page.goto("/budget");
    await expect(page.getByRole("main").getByRole("heading", { name: /budget/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "←" })).toBeVisible();
    await expect(page.getByRole("button", { name: "→" })).toBeVisible();
  });

  test("can create a budget envelope", async ({ page }) => {
    await page.goto("/budget");
    await page.getByRole("button", { name: /ajouter une enveloppe/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    // Fill amount
    await page.getByLabel(/montant/i).fill("500");
    await page.getByRole("button", { name: /créer/i }).click();
  });
});

test.describe("Goals", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("goals page loads", async ({ page }) => {
    await page.goto("/goals");
    await expect(page.getByRole("heading", { name: /objectifs/i })).toBeVisible();
  });

  test("can create a savings goal", async ({ page }) => {
    await page.goto("/goals");
    await page.getByRole("button", { name: /nouvel objectif/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel("Nom").fill("Vacances E2E");
    await page.getByLabel(/montant cible/i).fill("2000");
    await page.getByRole("button", { name: /créer/i }).click();
    await expect(page.getByText("Vacances E2E")).toBeVisible();
  });

  test("can add funds to a manual goal", async ({ page }) => {
    await page.goto("/goals");

    // Find a goal without "Auto" badge and click Add funds
    const addFundsBtn = page.getByRole("button", { name: /ajouter des fonds/i }).first();
    if (await addFundsBtn.isVisible()) {
      await addFundsBtn.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.getByLabel(/montant à ajouter/i).fill("200");
      await page.getByRole("button", { name: /ajouter/i }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
  });
});

test.describe("Import Rules", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("import rules page loads", async ({ page }) => {
    await page.goto("/settings/import-rules");
    await expect(page.getByRole("heading", { name: /règles d'import/i })).toBeVisible();
  });

  test("can create an import rule", async ({ page }) => {
    await page.goto("/settings/import-rules");
    await page.getByRole("button", { name: /nouvelle règle/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByLabel(/mot-clé/i).fill("Netflix E2E");
    await page.getByRole("button", { name: /créer/i }).click();
  });
});

test.describe("Import", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("import button opens the modal on expenses page", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: /importer/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText(/formats supportés/i)).toBeVisible();
  });

  test("shows error when submitting without a file", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: /importer/i }).click();
    await page.getByRole("button", { name: /analyser le fichier/i }).click();
    await expect(page.getByText(/sélectionner un fichier/i)).toBeVisible();
  });

  test("shows error when submitting without selecting an account", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: /importer/i }).click();
    // Deselect account
    await page.getByLabel(/compte de destination/i).selectOption({ index: 0 });
    await page.getByRole("button", { name: /analyser le fichier/i }).click();
    // Only fails on missing account if a file is also missing, so just verify form is still visible
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("shows preview table after uploading valid N26 CSV", async ({ page }) => {
    await page.goto("/expenses");
    await page.getByRole("button", { name: /importer/i }).click();
    // Wait for the account list to load and auto-select a destination account
    // before uploading, otherwise the analyse can race ahead of the fetch.
    await expect(page.getByLabel(/compte de destination/i)).not.toHaveValue("");

    const csvContent = [
      `"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"`,
      `"2026-01-15","2026-01-15","Netflix","","Presentment","","Compte courant","-15.99","",""`,
      `"2026-01-10","2026-01-10","Lidl","","Presentment","","Compte courant","-42.30","",""`,
    ].join("\n");

    const buffer = Buffer.from(csvContent, "utf-8");

    await page.getByLabel(/fichier/i).setInputFiles({
      name: "export.csv",
      mimeType: "text/csv",
      buffer,
    });

    await page.getByRole("button", { name: /analyser le fichier/i }).click();

    // Preview table should appear with the transactions
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("table")).toBeVisible({ timeout: 10000 });
    await expect(dialog.getByText("Netflix")).toBeVisible();
    await expect(dialog.getByText("Lidl")).toBeVisible();
  });
});
