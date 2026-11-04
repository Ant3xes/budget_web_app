# Tests E2E agentiques (tester-army/e2e)

Tests pilotés par agent, **en plus** de Playwright. Trois suites, trois dossiers séparés :

| Suite | Dossier | Commande |
|-------|---------|----------|
| Vitest (unitaires, API) | `__tests__/**/*.test.*` | `npm test` |
| Playwright + axe (E2E classiques) | `e2e/` | `npm run test:e2e` |
| E2E agentiques (`e2e`) | `tests/agentic/*.e2e.ts` | `npm run test:agentic` |

## Installation (déjà faite)

```bash
npm i -D e2e @e2e-dev/web ai
npx e2e init --yes --engine web --gateway vercel --skills none --mcp none --no-install
npx e2e telemetry disable
```

`package.json` : `"test:agentic": "e2e run"`. Configuration : `e2e.config.ts`.

## Règles

- **Modèle** : `gateway("google/gemini-2.5-flash-lite")` uniquement (offre gratuite). Ne jamais en changer, ne jamais acheter de crédits.
- **Clé** : `AI_GATEWAY_API_KEY` vient de l'environnement. Jamais dans le dépôt. Sans clé, les tests sans pas `agent.*` tournent quand même (aucun modèle requis) ; les tests avec `agent.act` se mettent en `skip`.
- **Télémétrie** : `E2E_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1`.
- **Serveur local uniquement** : `e2e.config.ts` refuse tout `APP_URL` qui n'est pas `localhost`. Jamais la production ni la démo en ligne.
- **Aucun envoi réel** : `tests/agentic/guards.ts` avorte (`browser.route`) `**/api/checkout**`, `checkout.stripe.com` et tout POST sur `/login` et `/signup` ; les tests vérifient que la requête a bien été interceptée. Pas de clé Stripe/Resend ni de jeton d'écriture dans l'environnement.
- **Préférer locators et URL à `agent.assert`** : le cache rejoue `act`, jamais `assert`.
- Le cache et les résultats (`.e2e/cache/`, `results/`, `sessions/`, `report.json`, logs, vidéos) sont ignorés par git.

## Lancer en local

```bash
export E2E_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
npm run build && npx next start -p 3100 &      # ou: npm run dev -- -p 3100
APP_URL=http://localhost:3100 npm run test:agentic
```

Les pages publiques (login, inscription, légales, 404, redirection) n'ont pas besoin de backend ; les parcours connectés demandent un Supabase local (`npm run db:start`).

Après `npm run dev` : restaurer `next-env.d.ts` (`git checkout next-env.d.ts`) et supprimer un éventuel `AGENTS.md` généré avant de commiter.

## Accessibilité

axe reste dans Playwright (`e2e/a11y.spec.ts`, `@axe-core/playwright`) : le moteur `e2e` n'expose pas de `Page` Playwright.
