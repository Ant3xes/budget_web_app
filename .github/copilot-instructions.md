# Copilot Instructions — Budget & Comptes

## Project Overview
Personal budget and bank accounts tracking web app for 1 owner + 2–5 invited friends. Each user has a fully isolated space (no shared expenses). Read `PRD.md` at the repo root for the full product context.

## Phase Status
| Phase | Statut | Contenu |
|-------|--------|---------|
| Phase 1 — Fondations | ✅ Done | Auth, invitations, CRUD accounts, sidebar, migrations RLS |
| Phase 2 — Transactions | ✅ Done | Categories, expenses/incomes, transfers, import CSV/XLS, import rules |
| Phase 3 — Budget & Analytics | ✅ Done | Budget envelopes, fixed charges, savings goals, dashboard Recharts |
| Phase 4 — Finition | 🚧 In progress | Profil utilisateur, détail compte, page `/plan` |

## Tech Stack
- **Framework**: Next.js 14+ with App Router + TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Backend/DB**: Supabase (PostgreSQL + Auth + Row Level Security)
- **Charts**: Recharts
- **Forms**: React Hook Form + Zod
- **XLS Import**: SheetJS (xlsx)
- **Tests**: Vitest (unit/integration) + Playwright (E2E)
- **Deployment**: Vercel + Supabase Cloud

## Critical Business Rules
- **Amounts are always stored as INTEGER cents**: `45.30€ = 4530`. Never use floats for money.
- **Soft delete only** on transactions: use `deleted_at TIMESTAMPTZ`, never hard delete.
- **Dates**: store in UTC in the DB, display in `Europe/Paris` timezone.
- **User isolation**: every query must be scoped to `user_id`. RLS policies enforce this at DB level.
- **Transfer** = 1 debit transaction + 1 credit transaction linked by a shared `transfer_id`.
- **Current balance** = `initial_balance_cents` + SUM of non-deleted transactions.
- **Fixed Charges ≠ Transactions**: `fixed_charges` is an independent referential with no link to imported transactions.
- **Monthly equivalent**: `quarterly → amount_cents / 3`, `yearly → amount_cents / 12`.
- **`next_due_date` auto-advance**: computed in TypeScript at `GET /api/fixed-charges` (not via DB cron). Loop +1/+3/+12 months until date ≥ today, then bulk UPDATE.

## Database Tables
`profiles`, `accounts`, `categories`, `transactions`, `budgets`, `fixed_charges`, `savings_goals`, `csv_import_rules`

## Key Schema Notes
- `transactions.kind` (not `type`): `'expense' | 'income' | 'transfer_debit' | 'transfer_credit'`
- `categories`: has `color TEXT` and `icon TEXT` (emoji or icon name) columns
- `budgets`: unique constraint on `(user_id, category_id, month)` — month stored as `YYYY-MM-01`
- `fixed_charges`: `status` → `'active' | 'suspended' | 'cancelled'`, soft delete via `deleted_at`
- `savings_goals`: independent of accounts — manual tracker with `target_amount_cents`, `current_amount_cents`

## API Routes
| Route | Methods | Notes |
|-------|---------|-------|
| `/api/accounts` | GET, POST, PATCH, DELETE | Soft delete via `deleted_at` |
| `/api/categories` | GET, POST, PATCH, DELETE | Filtered by `kind` param |
| `/api/transactions` | GET, POST, PATCH, DELETE | Params: `kind`, `account_id`, `category_id`, `date_from`, `date_to`, `q`, `page`, `per_page` |
| `/api/transfers` | GET, POST, PATCH, DELETE | POST creates debit+credit atomically |
| `/api/budgets` | GET, POST | GET param: `month=YYYY-MM`; returns `{ budgets, consumption }` |
| `/api/budgets/[id]` | PATCH, DELETE | PATCH: `amount_cents` only; DELETE: soft delete |
| `/api/fixed-charges` | GET, POST | GET auto-advances overdue `next_due_date` before returning |
| `/api/fixed-charges/[id]` | PATCH, DELETE | PATCH includes `status`; DELETE: soft delete |
| `/api/savings-goals` | GET, POST, PATCH, DELETE | — |
| `/api/import/preview` | POST | Parses CSV/XLS, returns rows with suggested categories |
| `/api/import/confirm` | POST | Inserts validated rows, max 500/batch |
| `/api/import-rules` | GET, POST, PATCH, DELETE | Keyword → category rules |
| `/api/profile` | PATCH | Updates `profiles.full_name`; password change via Supabase Auth `updateUser` (re-auth required) |
| `/api/invitations` | GET, POST, DELETE | Max 5 active invitations per user |

## Code Conventions
- Always validate inputs with **Zod** before any Supabase call.
- Clearly distinguish **Server Components** vs **Client Components** (`'use client'` directive).
- Use `createServerClient` (from `@supabase/ssr`) in Server Components and API routes.
- Use `createBrowserClient` (from `@supabase/ssr`) in Client Components.
- API routes: always check auth, validate input, handle errors explicitly.
- All monetary values in the UI must be formatted as euros (divide cents by 100).
- Index on `(user_id, date)` for all transaction queries.
- Month-navigation pattern: `useState` + `window.history.replaceState` (no Next.js navigation). Used in `BudgetList` and account detail.
- Budget consumption: `GROUP BY category_id` on `transactions` (kind=expense, date range, not deleted).
- Password change flow: re-authenticate via `signInWithPassword` with current password, then call `updateUser({ password })`.

## Recharts Components
| Component | Used in | Chart type |
|-----------|---------|------------|
| `PieChart` (donut) | Dashboard | Expenses by category (current month) |
| `BarChart` | Dashboard | Revenues vs Expenses over 6 months |
| `LineChart` | Account detail (`balance-chart.tsx`) | Balance evolution over 6 months |

## Import Formats
- **N26 CSV**: headers on row 1, `Amount (EUR)` column, `Booking Date` in `YYYY-MM-DD`.
- **BNP XLS**: non-standard header on row 1 (account info + balance), real columns start row 2, `Date operation` in `DD-MM-YYYY`.
- Auto-detect format from headers. Deduplicate by SHA-256 hash of `(date + description + amount_cents)`.
- Max 500 transactions per import batch.

## Navigation Structure
Dashboard / Accounts / Expenses / Incomes / Transfers / Budget / Fixed Charges / Goals / Settings

### Phase 4 routes
- `/settings/profile` — user profile (display name + password change)
- `/accounts/[id]` — account detail (transactions history + balance chart); edit moved to `/accounts/[id]/edit`
- `/plan` — roadmap page, **no auth required**, outside `(app)` group, fully static Server Component
