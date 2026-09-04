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

// Safety net for the dashboard redesign (see plan §6, Étape 0): captures the
// content contract of the current dashboard so the widget-extraction refactor
// in Étape 1 can't silently drop a section.
test.describe("Dashboard (smoke)", () => {
  test("renders the KPI cards, charts and recent transactions", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // 3 KPI cards
    await expect(page.getByText("Solde consolidé")).toBeVisible();
    await expect(page.getByText("Dépenses ce mois")).toBeVisible();
    await expect(page.getByText("Revenus ce mois")).toBeVisible();

    // Charts
    await expect(page.getByText("Dépenses par catégorie (mois en cours)")).toBeVisible();
    await expect(page.getByText("Revenus vs Dépenses (6 mois)")).toBeVisible();

    // Recent transactions section
    await expect(page.getByText("Dernières transactions")).toBeVisible();
  });
});
