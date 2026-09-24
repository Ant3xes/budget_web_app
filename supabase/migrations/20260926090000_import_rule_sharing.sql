-- Import rules that share a line automatically (phase 4), and an atomic import.
--
-- A rule (kind = expense, in a personal space) can carry a "share" setting:
-- the shared space to share the matching expense into, the common category and
-- the payer's share. The import modal pre-checks the matching lines; the
-- confirm step then creates the transactions AND their shared_expenses in one
-- SQL transaction (import_transactions), so an import is all-or-nothing.

-- ============================================================
-- 1. Sharing settings on import rules
-- ============================================================
alter table public.csv_import_rules
  add column if not exists share_space_id uuid references public.spaces(id) on delete set null,
  add column if not exists share_category_id uuid references public.categories(id) on delete set null,
  -- Null = the target space's default_share_percent, read when the rule is used.
  add column if not exists share_payer_percent smallint check (share_payer_percent between 0 and 100);

-- No CHECK constraint tying the three columns together on purpose: the
-- ON DELETE SET NULL foreign keys clear them one at a time when a space or a
-- category is deleted, and a CHECK could fail on the intermediate state and
-- block the delete. The trigger below keeps them consistent instead.
create or replace function public.validate_import_rule_share()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_category_space uuid;
begin
  -- No target space: nothing else may be set.
  if new.share_space_id is null then
    new.share_category_id := null;
    new.share_payer_percent := null;
    return new;
  end if;

  -- Re-check the target only when it (or the rule kind) changes, so clearing a
  -- deleted category, or a stale rule of a member who left, never blocks
  -- unrelated updates or deletes. The right to share is checked again when the
  -- rule is used (import preview and confirm).
  if tg_op = 'INSERT'
     or new.share_space_id is distinct from old.share_space_id
     or new.kind is distinct from old.kind then
    if new.kind <> 'expense' then
      raise exception 'only expense rules can share' using errcode = '23514';
    end if;
    if not exists (select 1 from public.spaces where id = new.space_id and kind = 'personal') then
      raise exception 'only the rules of a personal space can share' using errcode = '23514';
    end if;
    -- Membership of the rule's author (not auth.uid(): the seed runs without a JWT).
    if not exists (
      select 1
      from public.spaces s
      join public.space_members m on m.space_id = s.id
      where s.id = new.share_space_id and s.kind = 'shared' and m.user_id = new.user_id
    ) then
      raise exception 'the target must be a shared space you belong to' using errcode = '23514';
    end if;
  end if;

  if new.share_category_id is not null
     and (tg_op = 'INSERT' or new.share_category_id is distinct from old.share_category_id) then
    select space_id into v_category_space from public.categories where id = new.share_category_id;
    if v_category_space is distinct from new.share_space_id then
      raise exception 'the common category belongs to another space' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger csv_import_rules_validate_share
  before insert or update on public.csv_import_rules
  for each row execute function public.validate_import_rule_share();

-- ============================================================
-- 2. Atomic import: transactions + the shared expenses of the lines to share
-- ============================================================
-- SECURITY INVOKER on purpose: every insert goes through the caller's RLS and
-- the phase 1/2 triggers exactly as separate inserts would. Being one function
-- call it is one transaction: an invalid share rolls back the whole import.
--
-- p_rows: array of {id?, space_id, user_id, account_id, category_id?, transfer_id?,
--         kind, amount_cents, currency?, date, description?, is_imported?, raw_import_data?}
-- p_shares: array of {space_id, source_transaction_id, category_id?, shares}
--         (source_transaction_id refers to an `id` given in p_rows)
-- Returns the number of transactions inserted.
create or replace function public.import_transactions(p_rows jsonb, p_shares jsonb default '[]'::jsonb)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' or jsonb_typeof(p_shares) is distinct from 'array' then
    raise exception 'rows and shares must be arrays' using errcode = '22023';
  end if;

  insert into public.transactions (
    id, space_id, user_id, account_id, category_id, transfer_id, kind,
    amount_cents, currency, date, description, is_imported, raw_import_data
  )
  select
    coalesce(r.id, gen_random_uuid()), r.space_id, r.user_id, r.account_id, r.category_id, r.transfer_id,
    r.kind, r.amount_cents, coalesce(r.currency, 'EUR'), r.date, r.description,
    coalesce(r.is_imported, false), r.raw_import_data
  from jsonb_to_recordset(p_rows) as r(
    id uuid, space_id uuid, user_id uuid, account_id uuid, category_id uuid, transfer_id uuid,
    kind text, amount_cents integer, currency text, date timestamptz, description text,
    is_imported boolean, raw_import_data jsonb
  );
  get diagnostics v_count = row_count;

  -- paid_by is always the caller; amount / date / label are filled from the
  -- source transaction by prepare_shared_expense().
  insert into public.shared_expenses (space_id, source_transaction_id, paid_by, category_id, shares)
  select s.space_id, s.source_transaction_id, auth.uid(), s.category_id, s.shares
  from jsonb_to_recordset(p_shares) as s(space_id uuid, source_transaction_id uuid, category_id uuid, shares jsonb);

  return v_count;
end;
$$;

revoke execute on function public.import_transactions(jsonb, jsonb) from public, anon;
grant execute on function public.import_transactions(jsonb, jsonb) to authenticated;
