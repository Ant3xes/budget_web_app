---
name: budget-db-migration
description: Create a Supabase PostgreSQL migration for the budget_web_app following the project's conventions: soft delete via deleted_at TIMESTAMPTZ, amounts as INTEGER cents, user_id FK to auth.users, RLS with auth.uid(), existing set_updated_at trigger. Use when user asks to add a table, column, index, constraint, or RLS policy, or to write a Supabase migration for the budget app.
---

# budget-db-migration

## File naming

`supabase/migrations/YYYYMMDDHHmmss_snake_case_description.sql`

Latest: `20260528110000_phase4_import_rules_priority.sql` → next timestamp must be > `20260528110000`.

## Checklist

- [ ] `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`
- [ ] Amounts: `INTEGER NOT NULL` — never DECIMAL or FLOAT
- [ ] Soft delete: `deleted_at TIMESTAMPTZ` (no hard deletes anywhere)
- [ ] `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
- [ ] `updated_at TIMESTAMPTZ DEFAULT NOW()` + reuse existing trigger `set_updated_at` (don't recreate)
- [ ] `ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;`
- [ ] RLS policy: `USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())`
- [ ] Index on `(user_id, date DESC)` for transaction-like tables

## Minimal new table template

```sql
create table if not exists public.my_table (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  amount_cents integer not null,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  deleted_at   timestamptz
);

create trigger set_updated_at before update on public.my_table
  for each row execute function public.set_updated_at();

alter table public.my_table enable row level security;

create policy "Users access own rows" on public.my_table
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

## Key pitfalls

- `set_updated_at` function already exists — don't recreate it
- `profiles` uses `id = auth.uid()` (not `user_id`) for its RLS
- `invitations` has asymmetric policies (inviter vs invitee) — check before modifying
- `budgets` has a unique constraint on `(user_id, category_id, month)` — month stored as `YYYY-MM-01`
