create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  default_currency char(3) not null default 'EUR',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  inviter_user_id uuid not null references public.profiles(id) on delete cascade,
  accepted_by_user_id uuid references public.profiles(id) on delete set null,
  invitee_email text not null,
  token text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  type text not null check (type in ('courant', 'épargne', 'livret', 'PEL', 'autre')),
  initial_balance_cents integer not null default 0,
  currency char(3) not null default 'EUR',
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income', 'transfer')),
  color text,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, name, kind)
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  transfer_id uuid,
  kind text not null check (kind in ('expense', 'income', 'transfer_debit', 'transfer_credit')),
  amount_cents integer not null,
  currency char(3) not null default 'EUR',
  date timestamptz not null default timezone('utc', now()),
  description text,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists transactions_user_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_transfer_idx on public.transactions(user_id, transfer_id) where transfer_id is not null;

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  month date not null,
  amount_cents integer not null,
  currency char(3) not null default 'EUR',
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, category_id, month)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount_cents integer not null,
  currency char(3) not null default 'EUR',
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly', 'yearly')),
  next_charge_at timestamptz not null,
  alert_days_before integer not null default 7,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_amount_cents integer not null,
  current_amount_cents integer not null default 0,
  currency char(3) not null default 'EUR',
  deadline date,
  deleted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.csv_import_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  keyword text not null,
  category_id uuid references public.categories(id) on delete set null,
  kind text not null check (kind in ('expense', 'income')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger invitations_set_updated_at before update on public.invitations for each row execute function public.set_updated_at();
create trigger accounts_set_updated_at before update on public.accounts for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger transactions_set_updated_at before update on public.transactions for each row execute function public.set_updated_at();
create trigger budgets_set_updated_at before update on public.budgets for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function public.set_updated_at();
create trigger savings_goals_set_updated_at before update on public.savings_goals for each row execute function public.set_updated_at();
create trigger csv_import_rules_set_updated_at before update on public.csv_import_rules for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.accounts enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.subscriptions enable row level security;
alter table public.savings_goals enable row level security;
alter table public.csv_import_rules enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "invitations_select_owned" on public.invitations
for select using (auth.uid() = inviter_user_id or auth.uid() = accepted_by_user_id);
create policy "invitations_insert_owned" on public.invitations
for insert with check (auth.uid() = inviter_user_id);
create policy "invitations_update_owned" on public.invitations
for update using (auth.uid() = inviter_user_id or auth.uid() = accepted_by_user_id)
with check (auth.uid() = inviter_user_id or auth.uid() = accepted_by_user_id);

create policy "accounts_all_own" on public.accounts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "categories_all_own" on public.categories
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "transactions_all_own" on public.transactions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "budgets_all_own" on public.budgets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "subscriptions_all_own" on public.subscriptions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "savings_goals_all_own" on public.savings_goals
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "csv_import_rules_all_own" on public.csv_import_rules
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
