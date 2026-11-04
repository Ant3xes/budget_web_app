import type { Browser, WebRoute } from "@e2e-dev/web";

/**
 * Garde-fous communs : rien ne part vers un paiement ou un envoi réel.
 * - /api/checkout et checkout.stripe.com : avortés (l'app n'a pas de paiement
 *   aujourd'hui ; garde conservée pour qu'un futur parcours s'arrête au panier).
 * - POST des formulaires d'auth (server actions sur /login et /signup) :
 *   avortés et comptés, jamais envoyés.
 * Les lectures (GET) passent normalement vers le serveur LOCAL.
 */
export type SentLog = { blocked: string[] };

export async function installGuards(browser: Browser): Promise<SentLog> {
  const log: SentLog = { blocked: [] };
  const block = async (route: WebRoute) => {
    log.blocked.push(`${route.request.method} ${route.request.url}`);
    await route.abort();
  };
  await browser.route("**/api/checkout**", block);
  await browser.route("**://checkout.stripe.com/**", block);
  for (const path of ["login", "signup"]) {
    await browser.route(`**/${path}**`, async (route) => {
      if (route.request.method === "POST") return block(route);
      return route.fallback();
    });
  }
  return log;
}
