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

## Deploy (production)

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) (push sur `main`) lance les tests, applique les migrations Supabase, puis déploie sur Vercel. La configuration des secrets reste **manuelle**.

### Prérequis

1. Projet **Supabase Cloud** avec les migrations appliquées (ou via le job `db push`).
2. Projet **Vercel** lié au repo.
3. Secrets GitHub Actions à créer dans le dépôt :

| Secret | Usage |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL projet Supabase Cloud (job deploy) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon Cloud (job deploy) |
| `SUPABASE_ACCESS_TOKEN` | Token CLI pour `supabase link` / `db push` |
| `SUPABASE_PROJECT_REF` | Ref du projet Cloud |
| `VERCEL_TOKEN` | Token déploiement Vercel |
| `VERCEL_ORG_ID` | Org Vercel |
| `VERCEL_PROJECT_ID` | Projet Vercel |
| `SUPABASE_LOCAL_ANON_KEY` | Clé anon instance locale (job test CI) |
| `E2E_TEST_EMAIL` | Compte de test Playwright |
| `E2E_TEST_PASSWORD` | Mot de passe du compte de test |

4. Push sur `main` pour déclencher le pipeline.

Roadmap publique : [`/plan`](https://github.com/Ant3xes/budget_web_app) (route `/plan` dans l’app, sans auth).

## Licence

Tous droits réservés (voir [`LICENSE`](./LICENSE)). Le code est public à titre de portfolio : il n'est pas sous licence de réutilisation.
