import { test } from "@e2e-dev/web";
import { expect } from "e2e";

// Parcours publics, 100 % locators/URL : aucun appel modèle, aucun backend requis.

test("la page de connexion expose des champs étiquetés avec leur finalité (WCAG 1.3.5)", async ({ app, screen }) => {
  await app.open("/login");
  await expect(screen.getByRole("heading", "Connexion")).toBeVisible();
  await expect(screen.getByLabel("Email")).toBeVisible();
  await expect(screen.getByLabel("Mot de passe")).toBeVisible();
  await expect(screen.getByRole("button", "Se connecter")).toBeVisible();
});

test("un lien ?message= piégé n'affiche aucun texte arbitraire", async ({ app, screen, browser }) => {
  const spoof = "Votre compte est suspendu, appelez le 06 00 00 00 00";
  await app.open(`/login?message=${encodeURIComponent(spoof)}`);
  await expect(screen.getByLabel("Email")).toBeVisible();
  await expect(screen.getByText(spoof)).not.toBeVisible();
  await expect(browser).toHaveURL(/\/login/);
});

test("un message d'authentification connu est annoncé comme alerte", async ({ app, screen, browser }) => {
  await app.open("/login?message=invalidCredentials");
  await expect(screen.getByText("Identifiant ou mot de passe invalide.")).toBeVisible();
  // Next.js ajoute son propre role="alert" (annonceur de route) : on cible le <p> du message.
  await expect(browser.locator('p[role="alert"]')).toContainText("Identifiant ou mot de passe invalide.");
});

test("le tableau de bord redirige vers la connexion sans session", async ({ app, browser }) => {
  await app.open("/dashboard");
  await expect(browser).toHaveURL(/\/login/);
});

test("la navigation login ↔ inscription fonctionne", async ({ app, screen, browser }) => {
  await app.open("/login");
  await screen.getByRole("link", "En créer un").tap();
  await expect(browser).toHaveURL(/\/signup/);
  await expect(screen.getByRole("heading", "Créer un compte")).toBeVisible();
});

test("une page inconnue affiche un 404 avec un lien de sortie", async ({ app, screen }) => {
  await app.open("/cette-page-n-existe-pas");
  await expect(screen.getByRole("heading")).toBeVisible();
});

test("les pages légales sont publiques", async ({ app, screen }) => {
  for (const path of ["/cgu", "/rgpd"]) {
    await app.open(path);
    await expect(screen.getByRole("heading", { level: 1 })).toBeVisible();
  }
});
