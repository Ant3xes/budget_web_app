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

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

3. Start local Supabase and apply migrations:

   ```bash
   npx supabase start
   npx supabase db push
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

## Tests

```bash
# Unit / integration
npm run test

# E2E (requires app + Supabase running)
npx playwright test
```

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
