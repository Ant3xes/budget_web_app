-- Compte démo : restrictions additives, sans changer les policies existantes.
create table public.demo_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.demo_users enable row level security;
revoke all on table public.demo_users from anon, authenticated;

create or replace function public.is_demo_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.demo_users where user_id = auth.uid());
$$;
revoke all on function public.is_demo_user() from public, anon;
grant execute on function public.is_demo_user() to authenticated;

-- Liste vérifiée sur information_schema.tables après toutes les migrations.
-- Les futures tables métier doivent être ajoutées ici dans leur migration.
do $$
declare
  t text;
begin
  foreach t in array array[
    'accounts', 'budgets', 'categories', 'csv_import_rules', 'fixed_charges',
    'invitations', 'profiles', 'savings_goals', 'settlements', 'shared_expenses',
    'space_members', 'spaces', 'transactions'
  ] loop
    execute format(
      'create policy demo_readonly_insert on public.%I as restrictive for insert to authenticated with check (not public.is_demo_user())', t);
    execute format(
      'create policy demo_readonly_update on public.%I as restrictive for update to authenticated using (not public.is_demo_user()) with check (not public.is_demo_user())', t);
    execute format(
      'create policy demo_readonly_delete on public.%I as restrictive for delete to authenticated using (not public.is_demo_user())', t);
  end loop;
end;
$$;

-- Définition reprise de 20260924120000_spaces.sql ; seul le garde est ajouté.
create or replace function public.create_shared_space(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space_id uuid;
begin
  if public.is_demo_user() then
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;

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

-- Définition reprise de 20260924120000_spaces.sql ; seul le garde est ajouté.
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
  if public.is_demo_user() then
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;

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

-- Définition reprise de 20260924215711_share_transactions.sql ; seul le garde est ajouté.
create or replace function public.share_transactions(p_shares jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  if public.is_demo_user() then
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;

  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_shares) is distinct from 'array' then
    raise exception 'shares must be an array' using errcode = '22023';
  end if;

  -- paid_by is always the caller; amount / date / label are filled from the
  -- source transaction by prepare_shared_expense().
  insert into public.shared_expenses (space_id, source_transaction_id, paid_by, category_id, shares)
  select s.space_id, s.source_transaction_id, auth.uid(), s.category_id, s.shares
  from jsonb_to_recordset(p_shares) as s(space_id uuid, source_transaction_id uuid, category_id uuid, shares jsonb);
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

-- Définition reprise de 20260928090000_import_idempotent.sql ; seul le garde est ajouté.
create or replace function public.import_transactions(p_rows jsonb, p_shares jsonb default '[]'::jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_account uuid;
  v_skip_idx bigint[];
  v_skip_transfers uuid[];
  v_skip_ids uuid[];
  v_imported integer;
begin
  if public.is_demo_user() then
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;

  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_typeof(p_shares) is distinct from 'array' then
    raise exception 'rows and shares must be arrays' using errcode = '22023';
  end if;

  -- One import at a time per target account (ordered to avoid deadlocks).
  for v_account in
    select distinct (r ->> 'account_id')::uuid
    from jsonb_array_elements(p_rows) as r
    where r ->> 'account_id' is not null
    order by 1
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_account::text, 0));
  end loop;

  -- Imported lines already recorded in their account (or repeated in this very
  -- payload): skipped, along with what hangs off them.
  select
    coalesce(array_agg(e.n), '{}'),
    coalesce(array_agg((e.r ->> 'transfer_id')::uuid) filter (where e.r ->> 'transfer_id' is not null), '{}'),
    coalesce(array_agg((e.r ->> 'id')::uuid) filter (where e.r ->> 'id' is not null), '{}')
  into v_skip_idx, v_skip_transfers, v_skip_ids
  from jsonb_array_elements(p_rows) with ordinality as e(r, n)
  where coalesce((e.r ->> 'is_imported')::boolean, false)
    and e.r -> 'raw_import_data' ->> 'hash' is not null
    and (
      exists (
        select 1 from public.transactions t
        where t.account_id = (e.r ->> 'account_id')::uuid
          and t.is_imported
          and t.deleted_at is null
          and t.raw_import_data ->> 'hash' = e.r -> 'raw_import_data' ->> 'hash'
      )
      or exists (
        select 1 from jsonb_array_elements(p_rows) with ordinality as f(r, n)
        where f.n < e.n
          and f.r ->> 'account_id' = e.r ->> 'account_id'
          and f.r -> 'raw_import_data' ->> 'hash' = e.r -> 'raw_import_data' ->> 'hash'
      )
    );

  insert into public.transactions (
    id, space_id, user_id, account_id, category_id, transfer_id, kind,
    amount_cents, currency, date, description, is_imported, raw_import_data
  )
  select
    coalesce(r.id, gen_random_uuid()), r.space_id, r.user_id, r.account_id, r.category_id, r.transfer_id,
    r.kind, r.amount_cents, coalesce(r.currency, 'EUR'), r.date, r.description,
    coalesce(r.is_imported, false), r.raw_import_data
  from jsonb_array_elements(p_rows) with ordinality as e(j, n)
  cross join lateral jsonb_to_record(e.j) as r(
    id uuid, space_id uuid, user_id uuid, account_id uuid, category_id uuid, transfer_id uuid,
    kind text, amount_cents integer, currency text, date timestamptz, description text,
    is_imported boolean, raw_import_data jsonb
  )
  where not (e.n = any (v_skip_idx))
    and (r.transfer_id is null or not (r.transfer_id = any (v_skip_transfers)))
  order by e.n;

  select count(*) filter (where coalesce((e.j ->> 'is_imported')::boolean, false))
  into v_imported
  from jsonb_array_elements(p_rows) with ordinality as e(j, n)
  where not (e.n = any (v_skip_idx));

  -- paid_by is always the caller; amount / date / label are filled from the
  -- source transaction by prepare_shared_expense().
  insert into public.shared_expenses (space_id, source_transaction_id, paid_by, category_id, shares)
  select s.space_id, s.source_transaction_id, auth.uid(), s.category_id, s.shares
  from jsonb_to_recordset(p_shares) as s(space_id uuid, source_transaction_id uuid, category_id uuid, shares jsonb)
  where not (s.source_transaction_id = any (v_skip_ids));

  return v_imported;
end;
$$;

-- Définition reprise de 20261016100000_convert_transaction.sql ; seul le garde est ajouté.
create or replace function public.convert_transaction(
  p_id uuid,
  p_space_id uuid,
  p_kind text,
  p_account_id uuid,
  p_amount_cents integer,
  p_date date,
  p_description text,
  p_category_id uuid,
  p_notes text,
  p_mirror_kind text default null,
  p_mirror_account_id uuid default null,
  p_mirror_amount_cents integer default null
)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_row public.transactions%rowtype;
  v_transfer uuid;
begin
  if public.is_demo_user() then
    raise exception 'demo account is read-only' using errcode = '42501';
  end if;

  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_kind not in ('expense', 'income', 'transfer_debit', 'transfer_credit') then
    raise exception 'invalid kind' using errcode = '22023';
  end if;

  select * into v_row
  from public.transactions
  where id = p_id and space_id = p_space_id and deleted_at is null
  for update;
  if not found then
    raise exception 'transaction not found' using errcode = 'P0002';
  end if;

  -- Previous mirror line(s) of the transfer go away.
  if v_row.transfer_id is not null then
    update public.transactions
    set deleted_at = now()
    where transfer_id = v_row.transfer_id
      and space_id = p_space_id
      and id <> p_id
      and deleted_at is null;
  end if;

  if p_mirror_kind is not null then
    v_transfer := coalesce(v_row.transfer_id, gen_random_uuid());
  end if;

  update public.transactions
  set kind = p_kind,
      account_id = p_account_id,
      amount_cents = p_amount_cents,
      date = p_date,
      description = p_description,
      category_id = p_category_id,
      notes = p_notes,
      transfer_id = v_transfer
  where id = p_id and space_id = p_space_id;

  if p_mirror_kind is not null then
    insert into public.transactions (
      space_id, user_id, account_id, kind, amount_cents, currency, date,
      description, category_id, transfer_id, is_imported
    ) values (
      p_space_id, v_row.user_id, p_mirror_account_id, p_mirror_kind, p_mirror_amount_cents,
      v_row.currency, p_date, p_description, null, v_transfer, false
    );
  end if;
end;
$$;
