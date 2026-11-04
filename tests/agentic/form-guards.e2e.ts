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
// L'agent ne fait que SAISIR l'email ; l'envoi est fait par locator et
// avorté par le garde-fou (un clic de l'agent sur « envoyer » ferait afficher
// la page d'erreur de l'app, puisque le POST est volontairement coupé).
// Ignoré sans clé : on n'invente aucun résultat.
test("l'agent remplit le formulaire d'inscription sans l'envoyer", async ({ app, agent, screen, browser }) => {
  test.skip(!process.env.AI_GATEWAY_API_KEY, "AI_GATEWAY_API_KEY absente : pas d'appel modèle");
  const log = await installGuards(browser);
  await app.open("/signup");
  // Un objectif atomique par appel, chacun épinglé par un locator juste après
  // (le cache rejoue act, jamais assert).
  await agent.act("Type personne@example.invalid into the Email field. Do NOT press any button.");
  await expect(screen.getByLabel("Email")).toHaveValue("personne@example.invalid");
  // Champ sécurisé : sa valeur n'est jamais relue, on le remplit par locator.
  await screen.getByLabel("Mot de passe").fill("mot-de-passe-factice-1");
  expect(log.blocked).toEqual([]);
  await screen.getByRole("button", "Créer le compte").tap();
  await expect.poll(() => log.blocked.length).toBeGreaterThan(0);
});
