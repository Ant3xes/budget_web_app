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
| Phase 4 — Finition | 🚧 In progress | Profil utilisateur, détail compte, page `/plan` |

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
