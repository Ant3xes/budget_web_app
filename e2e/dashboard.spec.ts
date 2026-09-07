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

// Safety net for the dashboard v2 redesign (bank bubbles, combined
// expenses/income line, click-to-open overlay instead of navigation, i18n):
// captures the current dashboard's content contract so a future refactor
// can't silently drop a section or regress the FR default / EN toggle.
test.describe("Dashboard (smoke)", () => {
  test("renders the header, KPI tiles, charts and recent transactions", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();

    // Solde consolidé + bank bubbles (replaces the former "Comptes par banque" block)
    await expect(page.getByText("Solde consolidé")).toBeVisible();

    // Combined expenses/income tile (replaces the former separate "Dépenses
    // ce mois"/"Revenus ce mois" tiles)
    await expect(page.getByText("Dépenses / Revenus (ce mois)")).toBeVisible();
    await expect(page.getByText("Reste à vivre (hors charges)")).toBeVisible();

    // Charts
    await expect(page.getByText("Dépenses par catégorie (septembre 2026)")).toBeVisible();
    await expect(page.getByText("Revenus vs Dépenses (6 mois)")).toBeVisible();

    // New "Charges fixes" block
    await expect(page.getByText("Charges fixes (à venir)")).toBeVisible();

    // "Comptes par banque" was removed in favor of the bank bubbles
    await expect(page.getByText("Comptes par banque")).toHaveCount(0);

    // Recent transactions section
    await expect(page.getByText("Dernières transactions")).toBeVisible();
    await expect(page.getByText("Objectifs d'épargne")).toBeVisible();
  });

  test("period filter and category drill-down (overlay, not navigation) work", async ({ page }) => {
    await login(page);

    await expect(page.getByRole("link", { name: "Ce mois" })).toBeVisible();
    await expect(page.getByRole("link", { name: "3 mois" })).toBeVisible();

    await page.getByRole("link", { name: "3 mois" }).click();
    await expect(page).toHaveURL(/period=3m/);
    await expect(page.getByText("Dépenses par catégorie (3 mois)")).toBeVisible();
    // The trend chart keeps its 6-month floor regardless of a shorter filter.
    await expect(page.getByText("Revenus vs Dépenses (6 mois)")).toBeVisible();

    // Drill-down: a budget bar click now opens an in-place overlay instead
    // of navigating to /expenses (seed data has budgets for the current
    // month — see supabase/seed.sql).
    const budgetChart = page.locator("text=Budgets du mois en cours").locator("..");
    await budgetChart.locator(".recharts-bar-rectangle").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).not.toHaveURL(/\/expenses\?category_id=/);
  });

  test("switching to English updates menus and dashboard headings", async ({ page }) => {
    await login(page);

    await page.getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Consolidated balance")).toBeVisible();
    await expect(page.getByText("Recent transactions")).toBeVisible();
  });
});
