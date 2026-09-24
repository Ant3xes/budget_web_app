# 0001 — Spaces: data belongs to a space, not a user

Status: accepted (phase 1 implemented, phase 2 tracked in #51)

## Context

The app scoped every row to a single `user_id` with RLS `auth.uid() = user_id`.
We need a joint budget (e.g. a couple) next to each person's private data, and
the model must stay generic because the app may be opened to other users.

## Decision

- A **space** (`spaces`) owns the data; `space_members` (roles `owner` / `member`,
  equal rights on the data) says who can see it.
- Every user gets a **personal space** (one member, never shareable, not
  deletable) created by the sign-up trigger. Shared spaces are created with
  `create_shared_space()` and joined with `accept_space_invitation()`.
- The seven data tables (`accounts`, `categories`, `transactions`, `budgets`,
  `fixed_charges`, `savings_goals`, `csv_import_rules`) carry a NOT NULL
  `space_id`. `user_id` stays as the row's **author** (insert policies require
  `user_id = auth.uid()`).
- RLS uses `is_space_member(space_id)` (security definer, avoids recursion on
  `space_members`). Categories, budgets, goals and import rules are per space.
- Triggers enforce that a row's account/category live in the row's own space and
  that `space_id` never changes.
- The app works in one **active space** at a time (cookie `active-space`,
  re-validated against membership on every request by `getSpaceContext()`).
  RLS only proves membership, and a user can belong to several spaces, so every
  query is also filtered with `.eq("space_id", spaceId)`.

## Consequences

- Any new space-scoped table needs `space_id`, the four member policies, and an
  explicit space filter in each query (`withSpace()` in route handlers,
  `requireSpaceContext()` in server components).
- Leaving or being removed keeps what the member authored in the space.
- Access rules are covered by pgTAP tests (`supabase/tests/database`, run with
  `supabase test db`); the Vitest Supabase mocks do **not** exercise RLS.
- Phase 2 (#51) adds the "shared expense paid from a personal account" flag,
  the balance between members and settlements on top of this model.
