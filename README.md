# Budget & Comptes

Phase 1 implementation for a personal budget and bank accounts tracking app.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- Supabase (Auth + PostgreSQL + RLS)
- React Hook Form + Zod
- Recharts
- SheetJS (`xlsx`)

## Features implemented in Phase 1

- Supabase-ready Next.js app setup
- Email/password auth pages
- Invitation flow (up to 5 friends, independent user spaces)
- Full SQL schema with RLS policies and user profile trigger
- Accounts CRUD with current balance formula:
  - `current_balance = initial_balance + sum(non_deleted_transactions)`
- Main application shell with sidebar navigation:
  - Dashboard / Accounts / Expenses / Incomes / Transfers / Budget / Subscriptions / Goals

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

3. Apply SQL migration in Supabase SQL editor:

   - `/supabase/migrations/20260527183000_phase1.sql`

4. Start the app:

   ```bash
   npm run dev
   ```
