# Budget & Comptes

A personal budget tracker for bringing account balances, imported bank transactions and monthly spending into one place. It also supports shared expenses with friends without exposing the rest of a personal account's history.

This is Romain Pereira's personal project and portfolio code, not a client delivery or a banking service. Accounts and transactions are entered manually or imported from supported exports; the app does not connect to banks or initiate payments. No public demo URL or account screenshots are provided here.

## What is implemented

- **Accounts and transactions:** account types and banks, opening balances with an anchor date, income, expenses, internal transfers, categories, filters and pagination.
- **Import with review:** N26 CSV and BNP XLS/XLSX exports, preview before confirmation, duplicate detection, merchant/label normalization and ordered categorization rules. Transfer candidates require an internal/external choice; rules can also suggest sharing an expense.
- **Monthly planning:** category budget envelopes, recurring fixed charges and savings goals, with manual progress or progress linked to a category.
- **Dashboard and analytics:** balances, income versus expenses, budget consumption, spending by category, trends and period comparisons. Linked reimbursements reduce net spending, not the actual account balance.
- **Personal and shared spaces:** space switching, invitations, expense splits, balances between members and settlement records. Sharing a personal expense copies selected details to the shared space; the original transaction remains private. Settlements record repayments; they do not move money.
- **Everyday interface:** French/English dictionaries, light/dark themes and mobile navigation.

The [domain glossary](CONTEXT.md) defines these concepts; the [architecture decisions](docs/adr/) explain their trade-offs. The public in-app [plan page](app/plan/page.tsx) is a roadmap, not evidence that every listed item is shipped.

## Architecture

```text
Browser UI (React components, forms, charts)
    → Next.js Server Components / Server Actions / API route handlers
    → Supabase Auth + PostgreSQL queries and SQL RPCs
    → space-scoped data protected by row-level security (RLS)
```

The application uses Next.js 16 (App Router), React 19 and strict TypeScript, with Tailwind CSS v4, React Hook Form, Zod, Recharts and SheetJS. Exact versions and executable scripts live in [package.json](package.json) and [package-lock.json](package-lock.json), rather than a separate version table in this README.

| Location | Responsibility |
| --- | --- |
| [`app/`](app/) | Pages, layouts, authentication actions and API endpoints |
| [`components/`](components/) | Domain UI, forms, charts and shared UI primitives |
| [`lib/`](lib/) | Budget calculations, import parsers, validation, locale dictionaries and Supabase clients |
| [`lib/spaces/context.ts`](lib/spaces/context.ts) | Resolve the authenticated user's memberships and validate the active-space cookie on each request |
| [`supabase/migrations/`](supabase/migrations/) | Schema, RLS policies, triggers and RPCs, including aggregate queries |
| [`__tests__/`](__tests__/) | Vitest unit, component and API tests |
| [`supabase/tests/database/`](supabase/tests/database/) | pgTAP database, permissions and isolation tests |
| [`e2e/`](e2e/) | Playwright user journeys and accessibility checks |

Money is stored as integer cents. Account balances use gross transactions after the account's anchor date; spending reports can account for linked reimbursements. See the [balance-anchor decision](docs/adr/0003-balance-anchor-date.md) and [reimbursement decision](docs/adr/0004-linked-reimbursements.md).

Application queries explicitly select the active `space_id`; database RLS checks membership. A personal space is private, while members of a shared space can modify its shared data. This is not a read-only invitation model. See [spaces](docs/adr/0001-spaces-for-shared-budgets.md) and [shared expenses](docs/adr/0002-shared-expenses-and-settlements.md).

## Local development

### Prerequisites

- Node.js 22, as specified in [`.nvmrc`](.nvmrc), and npm. The npm scripts use POSIX shell syntax; on Windows, use a compatible environment such as WSL.
- Docker running for the local database and Auth services.
- Supabase CLI **2.116.0**, matching the [CI configuration](.github/workflows/ci.yml), available as `supabase` on your PATH. It is not installed by `npm ci`.
- A local checkout. The source is published for portfolio inspection, not under an open-source reuse license; see [License](#license).

From the repository root:

```bash
npm ci
npm run db:start
npm run db:reset
supabase status
```

If npm 12 rejects the existing SheetJS tarball with `EALLOWREMOTE`, use `npm ci --allow-remote=root` to allow the direct URL dependency declared in `package.json` for that installation; do not change the lockfile or enable arbitrary dependency install scripts.

`db:start` starts the services used by the app, excluding Studio and other optional services. **`db:reset` destroys and reseeds the local database**: use it only against your disposable local stack, never a linked or hosted database. Local service ports are defined in [`supabase/config.toml`](supabase/config.toml); stop conflicting stacks before starting this one.

### Environment

Create a gitignored `.env.local` at the repository root. The values below are **placeholders for local development**, not credentials:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-the-local-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

| Variable | Use |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Local API URL reported by `supabase status`; required by the Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Local anon key from `supabase status`; used with the user's session and RLS, never a service-role key |
| `NEXT_PUBLIC_SITE_URL` | Site origin for metadata, signup redirects and invitation links; defaults vary by call site, so set it explicitly |

Only use your local stack's URL and key. `NEXT_PUBLIC_*` values are included in browser bundles: never put privileged keys, passwords or other secrets there. Never commit `.env.local`, exported credentials or real financial data.

```bash
npm run dev
```

Open `http://localhost:3000`. Use the disposable local test users defined in [`supabase/seed.sql`](supabase/seed.sql), not a real account. That seed is applied by `db:reset`; the separate read-only demo seed is not.

### Checks and database types

These are available commands, not a claim that they have all passed on every checkout:

```bash
npm run check       # ESLint, TypeScript 7 compiler, Vitest unit/component/API tests
npm run test:db     # pgTAP; requires the local Supabase stack
npx playwright install chromium --with-deps
npm run test:e2e    # requires the local stack and .env.local; starts/reuses the dev app
npm run build      # production build, with the public Supabase env configured
```

Playwright's [configuration](playwright.config.ts) starts/reuses `http://localhost:3000` outside CI. In CI it expects an already running app; `PLAYWRIGHT_BASE_URL` overrides its target. Browser tests use local seeded accounts by default; `TEST_EMAIL` and `TEST_PASSWORD` optionally override them. These must refer to disposable test accounts, not personal credentials. The separate hosted smoke workflow uses its own configuration in [smoke.yml](.github/workflows/smoke.yml).

After changing migrations, run `npm run db:reset` then `npm run db:types` and commit the generated [`lib/supabase/database.types.ts`](lib/supabase/database.types.ts). CI checks for type drift when generation succeeds; registry failures can skip that check with a warning. Do not use a remote database push for local development.

`npm ci` runs `prepare` to install Lefthook in Git checkouts (skipped in CI, on Vercel and outside Git). [The hooks](lefthook.yml) run ESLint autofixes on staged TypeScript/JavaScript-module files before commit and typechecking before push. `npm run prepare` reinstalls them; no Prettier formatting step is configured.

Stop the local services when finished:

```bash
supabase stop --no-backup
```

## Current scope and limitations

- **Small personal-use scope:** intended for the owner and a few invited friends, not a certified accounting product, financial advice service or a demonstrated large-scale SaaS.
- **Import is format-specific:** N26 CSV and BNP XLS/XLSX layouts are supported, not arbitrary bank exports. Preview accepts files up to 2 MiB and 5,000 parsed rows; confirmation requests accept at most 500 transactions. Review suggestions and transfer choices before confirming. See [import guards](app/api/import/preview/route.ts) and [confirmation validation](app/api/import/confirm/route.ts).
- **Balances depend on input:** the opening balance, anchor date and imported/manual history determine the result; there is no live bank reconciliation feed.
- **Security has explicit boundaries:** login/signup/demo rate limiting is in memory per server instance, resets on cold start and is not distributed. The full nonce-based CSP is report-only; frame protection is enforced separately. See [the CSP decision](docs/adr/0005-csp-report-only-et-limites-d-import.md). RLS and tests do not amount to an independent security certification.
- **Tests have a defined scope:** the Vitest coverage configuration targets `lib/` and `app/api/`, not every page or component. Database isolation and browser journeys have separate suites; a command or badge alone does not prove a passing deployment.

### Optional read-only demo support

The code includes a demo login, but its availability and safety on a hosted instance are not established by this README. Normal local development does not require it. Do not expose a demo backed by real accounts or financial data.

The login/signup button appears only when both server-only `DEMO_USER_EMAIL` and `DEMO_USER_PASSWORD` are configured. They must never have a `NEXT_PUBLIC_` prefix, appear in logs, URLs or commits. Demo login verifies `is_demo_user()` and signs out if the account is not registered as a demo user. API mutation guards complement database restrictions, including SQL operations that could otherwise silently affect zero rows.

Enabling it is a separate, human-operated task: create a dedicated disposable Auth user, review and run [`supabase/demo/seed-demo.sql`](supabase/demo/seed-demo.sql) manually with that user's address, then configure the server variables. The seed contains synthetic data and is intentionally excluded from automatic migrations and reset seeds. Never invite this account into a real shared space. Before any public opening, disable public signup in Supabase Auth, verify the demo banner and rejected writes, and audit the instance.

**Known limitation:** SQL RLS does not protect the Auth API from a demo session changing the demo user's email/password. Credential reset and session revocation may be necessary. Details and restrictions are in [ADR 0007](docs/adr/0007-compte-demo-lecture-seule.md).

The demo browser test is opt-in and otherwise skipped. For an explicitly configured local demo server already running:

```bash
CI=1 DEMO_E2E_ENABLED=1 PLAYWRIGHT_BASE_URL=http://localhost:3166 npx playwright test e2e/demo.spec.ts --project chromium
```

## Deployment design

The repository targets Vercel for the app and Supabase for Auth/PostgreSQL; no deployment is required to inspect or run the project locally. Vercel's Git integration deploys the app separately from database migrations.

After successful CI on `main`, the [Deploy workflow](.github/workflows/deploy.yml) plans remote migrations. Pending migrations require human approval through `production-migrations` before application. It uses repository secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` and `SUPABASE_DB_PASSWORD`; none belongs in browser variables or source control. A manual run defaults to a dry run. Migration PRs have a separate [remote dry-run workflow](.github/workflows/migrations-dry-run.yml), with an explicit notice when secrets are unavailable.

Use additive, backward-compatible migrations: app deployment and database approval are not synchronized. Rollback of the app does not restore database state. Approval, backup/restore prerequisites and disabling the migration workflow are documented in [ADR 0006](docs/adr/0006-migrations-production.md). This is a description of the repository's delivery design, not confirmation of a currently healthy production deployment.

## Ownership and AI assistance

Romain Pereira maintains this personal project. The Git history records application changes under his name, including [mobile filtering work](https://github.com/Ant3xes/budget_web_app/commit/55b6c66) co-authored with Claude Sonnet 5. This attests to AI-assisted development, not exclusively handwritten code.

The available history does not establish a complete division of design, implementation, orchestration and verification between human and AI for every feature. No percentage or claim of sole authorship is implied. This README revision was prepared with an AI coding assistant by inspecting repository code and documentation; it is not an independent audit of the application.

## License

All rights reserved; see [`LICENSE`](LICENSE). The source is public for portfolio purposes only. Copying, modification, redistribution or reuse requires prior written permission from the author.
