import { test } from "@e2e-dev/web";
import { expect } from "e2e";

import { installGuards } from "./guards";

// Aucun envoi réel : le POST du formulaire est avorté par browser.route.

test("soumettre le formulaire de connexion est intercepté (locators)", async ({ app, screen, browser }) => {
  const log = await installGuards(browser);
  await app.open("/login");
  await screen.getByLabel("Email").fill("personne@example.invalid");
  await screen.getByLabel("Mot de passe").fill("mot-de-passe-factice-1");
  await screen.getByRole("button", "Se connecter").tap();
  await expect.poll(() => log.blocked.length).toBeGreaterThan(0);
  expect(log.blocked.every((entry) => entry.startsWith("POST "))).toBe(true);
});

// Seul test avec un pas agent (modèle gratuit imposé par e2e.config.ts).
// Ignoré sans clé : on n'invente aucun résultat.
test("l'agent remplit le formulaire d'inscription sans l'envoyer", async ({ app, agent, screen, browser }) => {
  test.skip(!process.env.AI_GATEWAY_API_KEY, "AI_GATEWAY_API_KEY absente : pas d'appel modèle");
  const log = await installGuards(browser);
  await app.open("/signup");
  await agent.act("Fill the email field with personne@example.invalid and the password field with mot-de-passe-factice-1, then press the create account button");
  // Les locators portent l'assertion (le cache rejoue act, jamais assert).
  await expect(screen.getByLabel("Email")).toHaveValue("personne@example.invalid");
  await expect.poll(() => log.blocked.length).toBeGreaterThan(0);
});
