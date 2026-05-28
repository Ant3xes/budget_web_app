import { expect, test } from "@playwright/test";
import path from "path";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@budget.local";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Password1234!";

async function login(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/mot de passe|password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

test.describe("Import CSV", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("import modal opens from accounts page", async ({ page }) => {
    await page.goto("/expenses");
    const importBtn = page.getByRole("button", { name: /importer|import/i }).first();
    await expect(importBtn).toBeVisible();
    await importBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("N26 CSV file is detected and previewed", async ({ page }) => {
    await page.goto("/expenses");

    // Open the first account's import
    const importBtn = page.getByRole("button", { name: /importer|import/i }).first();
    await importBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Wait for accounts to load (combobox auto-selects first account)
    await expect(dialog.getByRole("combobox")).not.toHaveValue("");

    // Upload a N26-formatted CSV fixture
    const csvContent = [
      `"Booking Date","Value Date","Payee","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"`,
      `"2026-01-15","2026-01-15","Netflix","","MasterCard Payment","","Main Account","-15.99","",""`,
      `"2026-01-10","2026-01-10","Spotify","","MasterCard Payment","","Main Account","-9.99","",""`,
    ].join("\n");

    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "n26-export.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });
    await dialog.getByRole("button", { name: /analyser/i }).click();

    // Should show preview with 2 transactions
    await expect(page.getByText(/2 transactions trouvées/i)).toBeVisible({ timeout: 10000 });
  });

  test("import confirmation inserts transactions", async ({ page }) => {
    await page.goto("/expenses");

    const importBtn = page.getByRole("button", { name: /importer|import/i }).first();
    await importBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Wait for accounts to load (combobox auto-selects first account)
    await expect(dialog.getByRole("combobox")).not.toHaveValue("");

    const uniqueId = Date.now();
    const csvContent = [
      `"Booking Date","Value Date","Payee","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)"`,
      `"2026-05-01","2026-05-01","Test Shop E2E ${uniqueId}","","MasterCard Payment","","Main Account","-9.99"`,
    ].join("\n");

    const fileInput = dialog.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "n26-test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    });
    await dialog.getByRole("button", { name: /analyser/i }).click();

    await expect(page.getByText(/1 transaction trouvée/i)).toBeVisible({ timeout: 10000 });
    await dialog.getByRole("button", { name: /^importer/i }).click();
    await expect(page.getByText(/importée.* avec succès/i)).toBeVisible({ timeout: 10000 });
  });
});
