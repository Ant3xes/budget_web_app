import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { gateway } from "ai";

/**
 * Tests agentiques (tester-army/e2e). Dossier séparé de Playwright (`e2e/`) et
 * de vitest (`__tests__/`) : ici, seulement `tests/agentic/*.e2e.ts`.
 * Voir docs/E2E-AGENTIQUE.md.
 */
const appUrl = process.env.APP_URL ?? "http://localhost:3000";

// Garde-fou : ces tests ne visent JAMAIS la prod ni la démo en ligne.
const { hostname } = new URL(appUrl);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname)) {
  throw new Error(`APP_URL doit pointer sur un serveur local (localhost), reçu : ${hostname}`);
}

export default {
  agents: {
    default: {
      // Offre gratuite uniquement : ne jamais changer de modèle ici.
      // Lit AI_GATEWAY_API_KEY (fournie par l'environnement, jamais commitée).
      model: gateway("google/gemini-2.5-flash-lite"),
      system:
        "You are a careful QA agent for a personal budget web app. Never submit a form for real: network writes are blocked by the test.",
    },
  },
  tests: "tests/agentic/**/*.e2e.ts",
  targets: [
    {
      engine: web(),
      app: { url: appUrl },
    },
  ],
} satisfies E2EConfig;
