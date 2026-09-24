-- Spaces: shared budgets (phase 1 of multi-user support).
--
-- Every data row now belongs to a *space* (personal or shared) instead of a
-- single user. A user gets one personal space (private, one member) at sign-up
-- and can create/join shared spaces. `user_id` stays on the data tables as the
-- row's *author*; access is decided by space membership.

-- ============================================================
-- 1. Spaces and members
-- ============================================================
create table if not exists public.spaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  kind text not null check (kind in ('personal', 'shared')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Exactly one personal space per user.
create unique index if not exists spaces_one_personal_per_user
  on public.spaces(created_by) where kind = 'personal';

create table if not exists public.space_members (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (space_id, user_id)
);

create index if not exists space_members_user_idx on public.space_members(user_id);

create trigger spaces_set_updated_at
  before update on public.spaces
  for each row execute function public.set_updated_at();

-- Only the name can change: turning a personal space into a shared (deletable,
-- invitable) one, or handing it to someone else, would break the model.
create or replace function public.prevent_space_identity_change()
returns trigger
language plpgsql
as $$
begin
  if new.kind is distinct from old.kind or new.created_by is distinct from old.created_by then
    raise exception 'space kind and creator cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger spaces_prevent_identity_change
  before update on public.spaces
  for each row execute function public.prevent_space_identity_change();

-- ============================================================
-- 2. Membership helpers (security definer: they read space_members
--    without going through its own RLS, which avoids policy recursion)
-- ============================================================
create or replace function public.is_space_member(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_space_owner(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.space_members
    where space_id = p_space_id and user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.shares_space_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = auth.uid() and theirs.user_id = p_user_id
  );
$$;

-- Internal helper (seed, backfill). Not exposed to API roles.
create or replace function public.personal_space_id(p_user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.spaces where created_by = p_user_id and kind = 'personal';
$$;

revoke execute on function public.personal_space_id(uuid) from public, anon, authenticated;

-- ============================================================
-- 3. Backfill: one personal space per existing profile
-- ============================================================
insert into public.spaces (name, kind, created_by)
select 'Personnel', 'personal', p.id
from public.profiles p
where not exists (
  select 1 from public.spaces s where s.created_by = p.id and s.kind = 'personal'
);

insert into public.space_members (space_id, user_id, role)
select s.id, s.created_by, 'owner'
from public.spaces s
where s.kind = 'personal'
on conflict do nothing;

-- ============================================================
-- 4. Scope the data tables by space
-- ============================================================
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'transactions', 'budgets',
    'fixed_charges', 'savings_goals', 'csv_import_rules'
  ] loop
    execute format(
      'alter table public.%I add column if not exists space_id uuid references public.spaces(id) on delete cascade', t);
    execute format(
      'update public.%I x set space_id = public.personal_space_id(x.user_id) where x.space_id is null', t);
    execute format('alter table public.%I alter column space_id set not null', t);
    execute format('create index if not exists %I on public.%I(space_id)', t || '_space_id_idx', t);

    execute format('drop policy if exists %I on public.%I', t || '_all_own', t);
    execute format(
      'create policy %I on public.%I for select using (public.is_space_member(space_id))',
      t || '_select_member', t);
    execute format(
      'create policy %I on public.%I for insert with check (public.is_space_member(space_id) and user_id = auth.uid())',
      t || '_insert_member', t);
    execute format(
      'create policy %I on public.%I for update using (public.is_space_member(space_id)) with check (public.is_space_member(space_id))',
      t || '_update_member', t);
    execute format(
      'create policy %I on public.%I for delete using (public.is_space_member(space_id))',
      t || '_delete_member', t);
  end loop;
end
$$;

-- A row can never be moved to another space (its accounts/categories would
-- be left behind).
create or replace function public.prevent_space_change()
returns trigger
language plpgsql
as $$
begin
  if new.space_id is distinct from old.space_id then
    raise exception 'space_id cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Accounts / categories referenced by a row must live in the row's own space.
-- (Plain FKs would let a row point at another space's account or category.)
create or replace function public.enforce_same_space()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_space uuid;
  v_category uuid;
begin
  -- Nested ifs on purpose: plpgsql resolves NEW.<column> when the whole
  -- condition is evaluated, so it must not be reached for tables without it.
  if tg_table_name in ('transactions', 'fixed_charges') then
    if new.account_id is not null then
      select space_id into v_space from public.accounts where id = new.account_id;
      if v_space is distinct from new.space_id then
        raise exception 'account belongs to another space' using errcode = '23514';
      end if;
    end if;
  end if;

  if tg_table_name = 'savings_goals' then
    v_category := new.linked_category_id;
  elsif tg_table_name in ('transactions', 'budgets', 'fixed_charges', 'csv_import_rules') then
    v_category := new.category_id;
  end if;

  if v_category is not null then
    select space_id into v_space from public.categories where id = v_category;
    if v_space is distinct from new.space_id then
      raise exception 'category belongs to another space' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'categories', 'transactions', 'budgets',
    'fixed_charges', 'savings_goals', 'csv_import_rules'
  ] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.prevent_space_change()',
      t || '_prevent_space_change', t);
  end loop;

  foreach t in array array[
    'transactions', 'budgets', 'fixed_charges', 'csv_import_rules', 'savings_goals'
  ] loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.enforce_same_space()',
      t || '_enforce_same_space', t);
  end loop;
end
$$;

-- Uniqueness is now per space.
alter table public.categories drop constraint if exists categories_user_id_name_kind_key;
alter table public.categories
  add constraint categories_space_id_name_kind_key unique (space_id, name, kind);

alter table public.budgets drop constraint if exists budgets_user_id_category_id_month_key;
alter table public.budgets
  add constraint budgets_space_id_category_id_month_key unique (space_id, category_id, month);

drop index if exists public.transactions_user_date_idx;
drop index if exists public.transactions_transfer_idx;
create index if not exists transactions_space_date_idx on public.transactions(space_id, date desc);
create index if not exists transactions_space_transfer_idx
  on public.transactions(space_id, transfer_id) where transfer_id is not null;

-- ============================================================
-- 5. RLS on spaces / space_members / profiles
-- ============================================================
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;

-- No INSERT policy on either table: spaces are created through
-- create_shared_space(), members join through accept_space_invitation().
create policy "spaces_select_member" on public.spaces
  for select using (public.is_space_member(id));
create policy "spaces_update_owner" on public.spaces
  for update using (public.is_space_owner(id)) with check (public.is_space_owner(id));
create policy "spaces_delete_owner" on public.spaces
  for delete using (public.is_space_owner(id) and kind = 'shared');

create policy "space_members_select_member" on public.space_members
  for select using (public.is_space_member(space_id));
-- A member can leave (owners cannot; they delete the space), an owner can
-- remove the other members.
create policy "space_members_delete" on public.space_members
  for delete using (
    (user_id = auth.uid() and role <> 'owner')
    or (public.is_space_owner(space_id) and user_id <> auth.uid())
  );

-- Co-members can read each other's profile (display name).
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_self_or_comember" on public.profiles
  for select using (auth.uid() = id or public.shares_space_with(id));

-- ============================================================
-- 6. Sign-up: personal space + default categories
-- ============================================================
drop function if exists public.seed_default_categories(uuid);

create or replace function public.seed_default_categories(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (space_id, user_id, name, kind, color, icon, is_default, translation_key) values
    -- Expenses
    (p_space_id, p_user_id, 'Alimentation',   'expense',  '#22c55e', '🛒', true, 'alimentation'),
    (p_space_id, p_user_id, 'Logement',       'expense',  '#3b82f6', '🏠', true, 'logement'),
    (p_space_id, p_user_id, 'Transport',      'expense',  '#f59e0b', '🚗', true, 'transport'),
    (p_space_id, p_user_id, 'Santé',          'expense',  '#ef4444', '🏥', true, 'sante'),
    (p_space_id, p_user_id, 'Loisirs',        'expense',  '#8b5cf6', '🎮', true, 'loisirs'),
    (p_space_id, p_user_id, 'Vêtements',      'expense',  '#ec4899', '👗', true, 'vetements'),
    (p_space_id, p_user_id, 'Restaurants',    'expense',  '#f97316', '🍽️', true, 'restaurants'),
    (p_space_id, p_user_id, 'Voyages',        'expense',  '#06b6d4', '✈️', true, 'voyages'),
    (p_space_id, p_user_id, 'Abonnements',    'expense',  '#6366f1', '📱', true, 'abonnements'),
    (p_space_id, p_user_id, 'Education',      'expense',  '#84cc16', '📚', true, 'education'),
    (p_space_id, p_user_id, 'Cadeaux',        'expense',  '#f43f5e', '🎁', true, 'cadeaux'),
    (p_space_id, p_user_id, 'Banque & Frais', 'expense',  '#64748b', '🏦', true, 'banque_frais'),
    -- Incomes
    (p_space_id, p_user_id, 'Salaire',        'income',   '#22c55e', '💰', true, 'salaire'),
    (p_space_id, p_user_id, 'Freelance',      'income',   '#3b82f6', '💻', true, 'freelance'),
    (p_space_id, p_user_id, 'Remboursement',  'income',   '#f59e0b', '🔄', true, 'remboursement'),
    (p_space_id, p_user_id, 'Autre revenu',   'income',   '#84cc16', '➕', true, 'autre_revenu'),
    -- Transfers
    (p_space_id, p_user_id, 'Virement interne', 'transfer', '#94a3b8', '🔁', true, 'virement_interne')
  on conflict (space_id, name, kind) do nothing;
end;
$$;

revoke execute on function public.seed_default_categories(uuid, uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));

  insert into public.spaces (name, kind, created_by)
  values ('Personnel', 'personal', new.id)
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, new.id, 'owner');

  perform public.seed_default_categories(v_space_id, new.id);
  return new;
end;
$$;

-- ============================================================
-- 7. Shared spaces API (security definer RPCs)
-- ============================================================
create or replace function public.create_shared_space(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  insert into public.spaces (name, kind, created_by)
  values (btrim(p_name), 'shared', auth.uid())
  returning id into v_space_id;

  insert into public.space_members (space_id, user_id, role)
  values (v_space_id, auth.uid(), 'owner');

  perform public.seed_default_categories(v_space_id, auth.uid());
  return v_space_id;
end;
$$;

revoke execute on function public.create_shared_space(text) from public, anon;
grant execute on function public.create_shared_space(text) to authenticated;

-- ============================================================
-- 8. Invitations: "invite into a space"
--    The former friend-invitation feature (no data access) is superseded.
-- ============================================================
alter table public.invitations
  add column if not exists space_id uuid references public.spaces(id) on delete cascade,
  add column if not exists expires_at timestamptz not null default (timezone('utc', now()) + interval '14 days');

update public.invitations set status = 'revoked' where space_id is null and status = 'pending';

drop policy if exists "invitations_select_owned" on public.invitations;
drop policy if exists "invitations_insert_owned" on public.invitations;
drop policy if exists "invitations_update_owned" on public.invitations;

create policy "invitations_select" on public.invitations
  for select using (
    auth.uid() = inviter_user_id
    or auth.uid() = accepted_by_user_id
    or (space_id is not null and public.is_space_member(space_id))
  );

create policy "invitations_insert" on public.invitations
  for insert with check (
    auth.uid() = inviter_user_id
    and space_id is not null
    and public.is_space_member(space_id)
    and exists (select 1 from public.spaces s where s.id = space_id and s.kind = 'shared')
  );

-- Only revocation goes through a plain UPDATE (the WITH CHECK pins the new
-- status); acceptance is the RPC below, which runs as the table owner.
create policy "invitations_revoke" on public.invitations
  for update
  using (
    status = 'pending'
    and (auth.uid() = inviter_user_id or (space_id is not null and public.is_space_owner(space_id)))
  )
  with check (
    status = 'revoked'
    and (auth.uid() = inviter_user_id or (space_id is not null and public.is_space_owner(space_id)))
  );

-- An invitation's target and token never change. Without this, an inviter could
-- retarget their invitation to a space they are not a member of and let an
-- accomplice join it.
create or replace function public.guard_invitation_update()
returns trigger
language plpgsql
as $$
begin
  if new.space_id is distinct from old.space_id
     or new.token is distinct from old.token
     or new.inviter_user_id is distinct from old.inviter_user_id
     or new.invitee_email is distinct from old.invitee_email then
    raise exception 'invitation target cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger invitations_guard_update
  before update on public.invitations
  for each row execute function public.guard_invitation_update();

create or replace function public.get_space_invitation(p_token text)
returns table (space_name text, inviter_name text, status text, expired boolean)
language sql
stable
security definer
set search_path = public
as $$
  select s.name, p.full_name, i.status, i.expires_at < timezone('utc', now())
  from public.invitations i
  join public.spaces s on s.id = i.space_id
  join public.profiles p on p.id = i.inviter_user_id
  where i.token = p_token;
$$;

grant execute on function public.get_space_invitation(text) to anon, authenticated;

create or replace function public.accept_space_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations%rowtype;
  v_members integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select * into v_inv from public.invitations
  where token = p_token and space_id is not null
  for update;

  if not found then
    raise exception 'invitation not found' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'pending' then
    raise exception 'invitation no longer valid' using errcode = '22023';
  end if;
  if v_inv.expires_at < timezone('utc', now()) then
    raise exception 'invitation expired' using errcode = '22023';
  end if;

  -- Serialize acceptances per space so two concurrent invitations cannot both
  -- squeeze past the member cap.
  perform 1 from public.spaces where id = v_inv.space_id for update;
  select count(*) into v_members from public.space_members where space_id = v_inv.space_id;
  if v_members >= 6 then
    raise exception 'space is full' using errcode = '22023';
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_inv.space_id, auth.uid(), 'member')
  on conflict do nothing;

  update public.invitations
  set status = 'accepted', accepted_by_user_id = auth.uid(), accepted_at = timezone('utc', now())
  where id = v_inv.id;

  return v_inv.space_id;
end;
$$;

revoke execute on function public.accept_space_invitation(text) from public, anon;
grant execute on function public.accept_space_invitation(text) to authenticated;
