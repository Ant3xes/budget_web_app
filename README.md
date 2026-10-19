# Budget & Comptes

Application web de suivi budgétaire et bancaire personnelle — 1 propriétaire + 2–5 amis invités, chacun dans un espace totalement isolé.

## Stack

- Next.js 14+ (App Router) + TypeScript strict
- Tailwind CSS v4
- Supabase (Auth + PostgreSQL + RLS)
- React Hook Form + Zod
- Recharts
- SheetJS (`xlsx`)
- Vitest (unit/integration) + Playwright (E2E)

## Phases

| Phase | Statut | Contenu |
|-------|--------|---------|
| Phase 1 — Fondations | ✅ Done | Auth, invitations, CRUD accounts, sidebar, migrations RLS |
| Phase 2 — Transactions | ✅ Done | Catégories, dépenses/revenus, virements, import CSV/XLS, règles import |
| Phase 3 — Budget & Analytics | ✅ Done | Enveloppes budget, charges fixes, objectifs, dashboard Recharts |
| Phase 4 — Finition | ✅ Done (deploy secrets manuel) | Profil, détail compte, `/plan`, dark mode, tests |

## Dev local

Prérequis : Node (voir `.nvmrc`), Docker démarré et Supabase CLI 2.116.0 (comme la CI).

```bash
npm ci
npm run db:start # supabase start, avec les services utiles à l'app uniquement
npm run db:reset # applique les migrations et le seed, efface uniquement la base locale
npm run db:types # régénère les types depuis cette base locale
```

Créer `.env.local` avec l'URL et la clé anon **locales** fournies par `supabase status`,
et `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Ne jamais committer ce fichier.
Les utilisateurs de démonstration et leurs identifiants sont définis dans
[`supabase/seed.sql`](supabase/seed.sql) : utiliser uniquement ces comptes locaux.

```bash
npm run dev
npm run check # ESLint + TypeScript 7 + tests unitaires/API
npm run test:db # pgTAP, stack locale requise
npm run test:e2e # Playwright ; app + Supabase locaux configurés
npm run build
supabase stop --no-backup
```

Après chaque modification de migration, relancer `npm run db:reset` puis
`npm run db:types` et committer `lib/supabase/database.types.ts` : la CI refuse
une dérive des types. Ne pas utiliser `supabase db push` pour le développement local.

`npm ci` / `npm install` installe les hooks Lefthook via `prepare` :
- **pre-commit** : `eslint --fix` sur les fichiers staged `.ts`, `.tsx`, `.mjs`, puis restage des corrections ;
- **pre-push** : `npm run typecheck`.

L'installation est ignorée en CI, sur Vercel et hors d'un checkout Git.
Pour réinstaller les hooks localement : `npm run prepare`. Aucun formatage Prettier n'est ajouté.

### Demo publique (issue 166)

Le bouton « Voir la demo » apparaît sur connexion/inscription seulement si les deux
variables **serveur uniquement** `DEMO_USER_EMAIL` et `DEMO_USER_PASSWORD` sont définies.
Ne jamais les préfixer par `NEXT_PUBLIC_`, les committer, les afficher dans les logs
ou les passer dans une URL. En local, utiliser un compte jetable de la stack locale ;
le seed demo n'est pas exécuté par `db:reset` : l'exécuter manuellement après création
du compte Auth, avec l'adresse de ce compte à la place du placeholder du script.
La session est refusée puis déconnectée si `is_demo_user()` ne confirme pas le rôle demo.

Pour lancer uniquement le parcours Playwright demo sur un serveur déjà démarré :
`CI=1 DEMO_E2E_ENABLED=1 PLAYWRIGHT_BASE_URL=http://localhost:3166 npx playwright test e2e/demo.spec.ts --project chromium`.
Sans opt-in explicite, ce test est ignoré : la CI habituelle n'a pas besoin d'un compte demo.

## Déploiement et migrations

Vercel déploie l'application via son intégration Git. Après une CI verte sur `main`,
[`Deploy`](.github/workflows/deploy.yml) simule les migrations Supabase (`plan`) et
publie leur liste dans le résumé du job. Seulement si des migrations sont en attente,
`apply` demande l'approbation **Ant3xes** via l'environnement **`production-migrations`**
(limité à `main`, distinct de `Production` utilisé par Vercel), puis les applique.
Sans migration en attente, aucune validation n'est demandée.

Configurer les secrets **du dépôt** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`
et `SUPABASE_DB_PASSWORD` : leur absence fait échouer le plan automatique. Un lancement
manuel sur `main` simule par défaut (`dry_run=true`, jamais d'application) ; sans
secrets, il affiche un warning. Les PR touchant `supabase/migrations/**` ont un
[dry-run distant](.github/workflows/migrations-dry-run.yml), ignoré avec notice si les
secrets ne sont pas disponibles (fork/Dependabot) ; les tests locaux restent dans la CI.

Les migrations doivent être additives et rétro-compatibles (expand/contract).
Avant le premier `apply`, relire le plan et vérifier les sauvegardes/PITR disponibles.
Procédure d'approbation, retour arrière et désactivation :
[ADR 0006](docs/adr/0006-migrations-production.md).

### Activation humaine de la demo sur Vercel / Supabase

Après validation humaine de la migration et avant d'ouvrir la demo :
1. Créer un utilisateur dédié dans **Supabase Auth** (jamais un compte réel existant).
2. Dans le **SQL editor**, exécuter manuellement
   [`supabase/demo/seed-demo.sql`](supabase/demo/seed-demo.sql), après remplacement de
   `demo@example.invalid` par son adresse. Cela marque le compte lecture seule et crée
   uniquement des données fictives. Ne jamais inclure ce seed dans un déploiement automatique.
3. Définir `DEMO_USER_EMAIL` et `DEMO_USER_PASSWORD` dans les variables **serveur**
   Vercel pour l'environnement concerné, puis redéployer. Aucun secret dans le dépôt.
4. Désactiver le signup public dans **Authentication > Sign In / Providers >
   Allow new users to sign up**. Les invitations restent le parcours voulu.
5. Vérifier le bouton, le bandeau et un refus d'écriture ; une erreur
   `demoMisconfigured` impose de corriger le marquage, pas de retirer le garde-fou.

Le bandeau ne remplace pas RLS. Les API refusent les mutations demo avant leur exécution,
y compris les UPDATE/DELETE que PostgreSQL aurait silencieusement limités à zéro ligne.
Le statut est chargé dans le contexte serveur mémorisé par requête, sans second RPC
après une écriture normale. Le rate-limit demo reste en mémoire par instance (comme
le login), pas distribué entre les instances Vercel. Les confirmations destructives
partagées sont désactivées ; les formulaires restent explorables et affichent un 403 traduit.

Roadmap publique : [`/plan`](https://github.com/Ant3xes/budget_web_app) (route `/plan` dans l’app, sans auth).

## Licence

Tous droits réservés (voir [`LICENSE`](./LICENSE)). Le code est public à titre de portfolio : il n'est pas sous licence de réutilisation.
