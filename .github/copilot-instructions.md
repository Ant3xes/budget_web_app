# Copilot Instructions — Budget & Comptes

## Project Overview
Personal budget and bank accounts tracking web app for 1 owner + 2–5 invited friends. Each user has a fully isolated space (no shared expenses). Read `PRD.md` at the repo root for the full product context.

## Tech Stack
- **Framework**: Next.js 14+ with App Router + TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Backend/DB**: Supabase (PostgreSQL + Auth + Row Level Security)
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **XLS Import**: SheetJS (xlsx)
- **Deployment**: Vercel + Supabase Cloud

## Critical Business Rules
- **Amounts are always stored as INTEGER cents**: `45.30€ = 4530`. Never use floats for money.
- **Soft delete only** on transactions: use `deleted_at TIMESTAMPTZ`, never hard delete.
- **Dates**: store in UTC in the DB, display in `Europe/Paris` timezone.
- **User isolation**: every query must be scoped to `user_id`. RLS policies enforce this at DB level.
- **Transfer** = 1 debit transaction + 1 credit transaction linked by a shared `transfer_id`.
- **Current balance** = `initial_balance` + SUM of non-deleted transactions.

## Database Tables
`profiles`, `accounts`, `categories`, `transactions`, `budgets`, `subscriptions`, `savings_goals`, `csv_import_rules`

## Code Conventions
- Always validate inputs with **Zod** before any Supabase call.
- Clearly distinguish **Server Components** vs **Client Components** (`'use client'` directive).
- Use `createServerClient` (from `@supabase/ssr`) in Server Components and API routes.
- Use `createBrowserClient` (from `@supabase/ssr`) in Client Components.
- API routes: always check auth, validate input, handle errors explicitly.
- All monetary values in the UI must be formatted as euros (divide cents by 100).
- Index on `(user_id, date)` for all transaction queries.

## Import Formats
- **N26 CSV**: headers on row 1, `Amount (EUR)` column, `Booking Date` in `YYYY-MM-DD`.
- **BNP XLS**: non-standard header on row 1 (account info + balance), real columns start row 2, `Date operation` in `DD-MM-YYYY`.
- Auto-detect format from headers. Deduplicate by hash of `(date + description + amount_cents)`.

## Navigation Structure
Dashboard / Accounts / Expenses / Incomes / Transfers / Budget / Subscriptions / Goals
