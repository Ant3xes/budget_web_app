<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`github.com/Ant3xes/budget_web_app`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical label vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.

## Environment & guardrails

*(Ported from Claude Code's `~/.claude/settings.json` auto-mode config, Sept 2026 — adapt/re-verify if this drifts from reality.)*

- **Cloud providers**: Supabase (Auth + PostgreSQL + RLS); Vercel (deploy target, via CI secrets `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID`/`VERCEL_TOKEN`)
- **Repository visibility**: PUBLIC — `Ant3xes/budget_web_app` on github.com. Only this repo's own work belongs there; confidential material (personal/banking data, credentials) must never be committed regardless of visibility.
- **Secrets**: environment variables via `.env.local` (gitignored) and CI secrets: `E2E_TEST_EMAIL`, `E2E_TEST_PASSWORD`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_LOCAL_ANON_KEY`, `SUPABASE_PROJECT_REF`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_TOKEN`. Never let any of these leak into a commit, log, or paste service.
- **Default/protected branches**: `main` is the default branch. Classic branch protection is active on `main` (no repository rulesets): changes go through a pull request and the 5 required status checks must pass. Admins can bypass it; do not push or force-push to `main` directly unless Romain explicitly asks.
- **CI/CD deploy targets**: Vercel (via `.github/workflows` and `VERCEL_*` secrets); Supabase project (via `SUPABASE_*` secrets). Scope any deploy command (`vercel deploy`, `supabase db push`) to this project's own target — never a shared/other org target.
- **Sensitive data**: `.env.local` and any file holding personal/banking data — this app tracks personal budget & bank account data for the owner + 2–5 invited friends, each in an isolated space (RLS-enforced). Treat this as PII; never paste sample rows into a public issue, gist, or chat.
- **Sensitive remote targets**: any namespace, host, or container whose name contains `prod` or `production` as a whole word/segment — treat as protected even without explicit tooling enforcement.
- **Primary use**: personal/hobby budget tracking web app, also serving as a freelance portfolio piece (see the `romain-personal-context` skill, `freelance-transition.md`, for the dual purpose).

