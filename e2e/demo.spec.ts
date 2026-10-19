import { expect, test } from "@playwright/test";

// Opt-in: the ordinary CI server has no demo credentials (issue 166).
// The credentials belong only to the app process, never to Playwright/browser input.
test.skip(process.env.DEMO_E2E_ENABLED !== "1", "Requires an explicitly enabled local demo server and manually seeded demo account");

test("demo: dashboard, responsive read-only banner, 403 and logout", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Voir la demo", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const banner = page.getByRole("status").filter({ hasText: "Mode demo : lecture seule, donnees fictives" });
  await expect(banner).toBeVisible();
  await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
  await expect(page.locator("main")).toContainText("€");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(banner).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/transactions");
  await page.getByRole("button", { name: "+ Ajouter", exact: true }).click();
  await page.getByRole("menuitem", { name: "+ Dépense", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Compte", exact: true }).selectOption({ label: "Compte courant démo" });
  await dialog.getByLabel("Montant (€)", { exact: true }).fill("1.00");
  await dialog.getByLabel("Description", { exact: true }).fill("Tentative demo interdite");
  const denied = page.waitForResponse((r) => r.url().endsWith("/api/transactions") && r.request().method() === "POST");
  await dialog.getByRole("button", { name: "Créer", exact: true }).click();
  expect((await denied).status()).toBe(403);
  await expect(dialog.getByText("Compte demo en lecture seule", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler", exact: true }).click();
  await page.getByRole("button", { name: "Quitter la demo", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
