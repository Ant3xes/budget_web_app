-- Replace subscriptions table with fixed_charges (as per PRD)
-- Add missing columns to transactions table

-- 1. Drop old subscriptions table
drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
drop policy if exists "subscriptions_all_own" on public.subscriptions;
drop table if exists public.subscriptions;

-- 2. Create fixed_charges table (PRD schema)
create table if not exists public.fixed_charges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  amount_cents  integer not null,
  currency      char(3) not null default 'EUR',
  frequency     text not null check (frequency in ('monthly', 'quarterly', 'yearly')),
  next_due_date date not null,
  account_id    uuid references public.accounts(id) on delete set null,
  category_id   uuid references public.categories(id) on delete set null,
  notes         text,
  status        text not null default 'active' check (status in ('active', 'suspended', 'cancelled')),
  deleted_at    timestamptz,
  created_at    timestamptz not null default timezone('utc', now()),
  updated_at    timestamptz not null default timezone('utc', now())
);

create trigger fixed_charges_set_updated_at
  before update on public.fixed_charges
  for each row execute function public.set_updated_at();

alter table public.fixed_charges enable row level security;

create policy "fixed_charges_all_own" on public.fixed_charges
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Add missing columns to transactions (PRD schema)
alter table public.transactions
  add column if not exists notes text,
  add column if not exists raw_import_data jsonb,
  add column if not exists is_imported boolean not null default false;
