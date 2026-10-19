import { must } from "@/__tests__/helpers/must";
import { expect, test, type Page } from "@playwright/test";

const TEST_EMAIL = process.env.TEST_EMAIL ?? "test@budget.local";
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "Password1234!";

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/mot de passe|password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /connexion|se connecter|login|sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/);
}

// Same API setup as transactions.spec.ts: never rely on seed account ids.
async function createAccounts(page: Page, names: string[]) {
  for (const name of names) {
    const res = await page.request.post("/api/accounts", {
      data: { name, type: "courant", initialBalanceCents: 0 },
    });
    expect(res.ok()).toBeTruthy();
  }
}

const unique = () => `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const today = () => new Date().toISOString().slice(0, 10);

async function accountFixtures(page: Page, tag: string) {
  const names = [`F A ${tag}`, `F B ${tag}`];
  await createAccounts(page, names);
  const response = await page.request.get("/api/accounts");
  expect(response.ok()).toBeTruthy();
  const { accounts } = await response.json();
  return names.map((name) => {
    const account = accounts.find((entry: { id: string; name: string }) => entry.name === name);
    expect(account, `API account ${name} exists`).toBeTruthy();
    return account as { id: string; name: string };
  });
}

async function createTransaction(page: Page, accountId: string, description: string, amount: number, categoryId?: string) {
  const response = await page.request.post("/api/transactions", {
    data: {
      account_id: accountId,
      description,
      kind: amount < 0 ? "expense" : "income",
      amount_cents: amount,
      date: today(),
      ...(categoryId ? { category_id: categoryId } : {}),
    },
  });
  expect(response.ok()).toBeTruthy();
  const saved = await page.request.get("/api/transactions", { params: { q: description } });
  expect(saved.ok()).toBeTruthy();
  const { transactions } = await saved.json();
  const transaction = transactions.find((entry: { description: string }) => entry.description === description);
  expect(transaction, "created transaction can be read back").toBeTruthy();
  return transaction as { id: string };
}

async function openTransaction(page: Page, description: string) {
  await page.goto("/transactions");
  // Search avoids pagination and other tests' transactions, including on mobile.
  await page.locator('input[placeholder="Rechercher…"]:visible').fill(description);
  await page.locator('input[placeholder="Rechercher…"]:visible').press("Enter");
  await page.getByRole("button", { name: description, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  return page.getByRole("dialog");
}

function transactionRow(page: Page, description: string) {
  const label = page.getByRole("button", { name: description, exact: true });
  return page.getByRole("row").filter({ has: label })
    .or(page.getByRole("listitem").filter({ has: label })).filter({ visible: true });
}

async function analyzeImport(page: Page, tag: string, includeTransfer: boolean) {
  await accountFixtures(page, tag);
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Importer", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/compte de destination/i).selectOption({ index: 1 });
  const date = today();
  const rows = [
    '"Booking Date","Value Date","Partner Name","Partner Iban",Type,"Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"',
    `${date},${date},Boutique fictive ${tag},,Presentment,Carte synthétique,Compte fictif,-12.34,-12.34,EUR,1`,
  ];
  if (includeTransfer) {
    rows.push(`${date},${date},Camille Exemple ${tag},,Debit Transfer,Virement synthétique,Compte fictif,-23.45,-23.45,EUR,1`);
  }
  await dialog.getByLabel(/fichier/i).setInputFiles({
    name: `n26-synthetique-${tag}.csv`, mimeType: "text/csv", buffer: Buffer.from(rows.join("\n")),
  });
  await dialog.getByRole("button", { name: "Analyser le fichier", exact: true }).click();
  await expect(dialog.getByText("Étape 2 — Dépenses", { exact: true })).toBeVisible();
  return dialog;
}

test.describe("Retours 2", () => {
  test.beforeEach(async ({ page }) => { await login(page); });

  test("le libellé ouvre la modale sans bouton Modifier", async ({ page }) => {
    const tag = unique();
    const [account] = await accountFixtures(page, tag);
    const description = `Ouverture F ${tag}`;
    await createTransaction(page, must(account).id, description, -2500);
    await page.goto("/transactions");
    await page.locator('input[placeholder="Rechercher…"]:visible').fill(description);
    await page.locator('input[placeholder="Rechercher…"]:visible').press("Enter");
    await expect(transactionRow(page, description)).toBeVisible();
    await expect(transactionRow(page, description)).not.toHaveAttribute("role", "button");
    await expect(page.getByRole("button", { name: /^Modifier$/ })).toHaveCount(0);
    await page.getByRole("button", { name: description, exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Modifier$/ })).toHaveCount(0);
  });

  test("une dépense convertie en revenu affiche un montant positif", async ({ page }) => {
    const tag = unique();
    const [account] = await accountFixtures(page, tag);
    const description = `Revenu F ${tag}`;
    await createTransaction(page, must(account).id, description, -2500);
    const dialog = await openTransaction(page, description);
    await dialog.getByRole("group", { name: "Type", exact: true }).getByRole("button", { name: "Revenus", exact: true }).click();
    await dialog.getByRole("button", { name: "Mettre à jour", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(transactionRow(page, description)).toContainText(/\+25,00\s*€/);
  });

  test("une dépense convertie en virement affiche source → destination, pas Revenu", async ({ page }) => {
    const tag = unique();
    const [source, destination] = await accountFixtures(page, tag);
    const description = `Virement F ${tag}`;
    await createTransaction(page, must(source).id, description, -3500);
    const dialog = await openTransaction(page, description);
    await dialog.getByRole("group", { name: "Type", exact: true }).getByRole("button", { name: "Virements", exact: true }).click();
    await dialog.getByLabel(/compte source/i).selectOption(must(source).id);
    await dialog.getByLabel(/compte destination/i).selectOption(must(destination).id);
    await dialog.getByRole("button", { name: "Mettre à jour", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    const row = transactionRow(page, description);
    await expect(row).toContainText(`${must(source).name} → ${must(destination).name}`);
    await expect(row).not.toContainText(/Revenu/);
  });

  test("lier 60 € à une dépense de 90 € affiche 30 € sur 90 €", async ({ page }) => {
    const tag = unique();
    const [account] = await accountFixtures(page, tag);
    const description = `Dépense remboursée F ${tag}`;
    await createTransaction(page, must(account).id, description, -9000);
    const refund = await createTransaction(page, must(account).id, `Entrée F ${tag}`, 6000);
    const dialog = await openTransaction(page, description);
    const section = dialog.getByRole("region", { name: "Remboursements", exact: true });
    await section.getByRole("combobox", { name: "Lier un remboursement", exact: true }).selectOption(refund.id);
    await section.getByRole("button", { name: "Lier un remboursement", exact: true }).click();
    await expect(section.getByText(/Remboursé : 60,00\s*€/)).toBeVisible();
    await dialog.getByRole("button", { name: "Mettre à jour", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(transactionRow(page, description)).toContainText(/30,00\s*€ sur 90,00\s*€/);
  });

  test("un import N26 attend le choix Externe du virement", async ({ page }) => {
    const tag = unique();
    const dialog = await analyzeImport(page, tag, true);
    await dialog.getByRole("button", { name: "Suivant →", exact: true }).click();
    await dialog.getByRole("button", { name: "Suivant →", exact: true }).click();
    const submit = dialog.getByRole("button", { name: "Importer 2 transactions", exact: true });
    await expect(dialog.getByText("1 virement(s) à choisir : interne ou externe.", { exact: true })).toBeVisible();
    await expect(submit).toBeDisabled();
    await dialog.getByRole("combobox").filter({ has: page.getByRole("option", { name: "Externe (dépense / revenu)", exact: true }) })
      .selectOption({ label: "Externe (dépense / revenu)" });
    await expect(submit).toBeEnabled();
    await submit.click();
    await expect(dialog.getByText("Import terminé", { exact: true })).toBeVisible();
    await expect(dialog.getByText(/2 transactions importées/)).toBeVisible();
    // Both lines exist after the import (the external transfer became an expense).
    const listed = await page.request.get(`/api/transactions?q=${encodeURIComponent(tag)}&per_page=100`);
    expect(listed.ok()).toBeTruthy();
    const body = await listed.json();
    const found = (body.transactions ?? []).map((t: { description: string }) => t.description.toLowerCase());
    expect(found.some((d: string) => d.includes("boutique fictive"))).toBeTruthy();
    expect(found.some((d: string) => d.includes("camille exemple"))).toBeTruthy();
  });

  test("créer une catégorie depuis l'import la sélectionne et la persiste", async ({ page }) => {
    const tag = unique();
    const dialog = await analyzeImport(page, tag, false);
    const categoryName = `Catégorie F ${tag}`;
    const categorySelect = dialog.getByRole("combobox").filter({ has: page.getByRole("option", { name: "+ Nouvelle catégorie", exact: true }) }).first();
    await categorySelect.selectOption({ label: "+ Nouvelle catégorie" });
    await dialog.getByLabel("Nom de la nouvelle catégorie", { exact: true }).fill(categoryName);
    await dialog.getByRole("button", { name: "Créer", exact: true }).click();
    await expect(categorySelect.locator("option:checked")).toHaveText(categoryName);
    const response = await page.request.get("/api/categories");
    expect(response.ok()).toBeTruthy();
    const { categories } = await response.json();
    const category = categories.find((entry: { name: string }) => entry.name === categoryName);
    expect(category).toMatchObject({ name: categoryName, kind: "expense" });
    await dialog.getByRole("button", { name: "Appliquer à la sélection", exact: true }).click();
    await dialog.getByRole("button", { name: "Suivant →", exact: true }).click();
    await dialog.getByRole("button", { name: "Suivant →", exact: true }).click();
    await dialog.getByRole("button", { name: "Importer 1 transaction", exact: true }).click();
    await expect(dialog.getByText("Import terminé", { exact: true })).toBeVisible();
    const saved = await page.request.get("/api/transactions", { params: { q: `Boutique fictive ${tag}` } });
    expect(saved.ok()).toBeTruthy();
    const { transactions } = await saved.json();
    expect(transactions).toHaveLength(1);
    expect(transactions[0].category_id).toBe(category.id);
  });

  test("analytics sans paramètre sélectionne Ce mois", async ({ page }) => {
    await page.goto("/analytics");
    await expect(page).toHaveURL(/\/analytics$/);
    const currentMonth = page.getByRole("link", { name: "Ce mois", exact: true });
    await expect(currentMonth).toBeVisible();
    await expect(currentMonth).toHaveClass(/\bbg-foreground\b/);
  });

  test("la bascule retire une catégorie de l'histogramme", async ({ page }) => {
    const tag = unique();
    const [account] = await accountFixtures(page, tag);
    const categoryName = `F${Date.now()}`;
    const created = await page.request.post("/api/categories", { data: { name: categoryName, kind: "expense" } });
    expect(created.ok()).toBeTruthy();
    const response = await page.request.get("/api/categories");
    expect(response.ok()).toBeTruthy();
    const { categories } = await response.json();
    const category = categories.find((entry: { name: string }) => entry.name === categoryName);
    expect(category).toBeTruthy();
    await createTransaction(page, must(account).id, `Histogramme F ${tag}`, -4200, category.id);
    await page.goto("/analytics");
    await page.getByRole("link", { name: "Catégories", exact: true }).click();
    const heading = page.getByRole("heading", { name: /^Histogramme des dépenses par catégorie/ });
    await expect(heading).toBeVisible();
    const histogram = heading.locator("..");
    // The chart is mounted when it nears the viewport (issue 168): bring it in
    // before asserting on its SVG, exactly as a user scrolling would.
    await histogram.scrollIntoViewIfNeeded();
    const toggle = histogram.getByRole("switch", { name: new RegExp(categoryName) });
    const chartLabel = histogram.locator("svg").getByText(categoryName, { exact: true });
    await expect(toggle).toBeChecked();
    await expect(chartLabel).toBeVisible();
    await toggle.uncheck();
    await expect(toggle).not.toBeChecked();
    await expect(chartLabel).toHaveCount(0);
    // The control stays available and can restore precisely that category.
    await toggle.check();
    await expect(chartLabel).toBeVisible();
  });
});
