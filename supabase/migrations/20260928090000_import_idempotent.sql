-- Idempotent import: re-sending the same lines never records them twice.
--
-- The preview flags already-imported lines, but nothing stopped a double click
-- on "Import", a network retry or two open tabs from inserting a batch twice.
-- import_transactions() now skips, inside its own SQL transaction, every
-- imported line whose hash (raw_import_data->>'hash') already exists in the
-- target account — together with the mirror line and the shared expense that
-- belong to a skipped line. Imports into one account are serialised with an
-- advisory lock, so two concurrent calls cannot both pass the check.
--
-- Not a UNIQUE index on purpose: databases that already hold duplicates (from
-- the old behaviour) could not create it, and we never delete user data here.

create index if not exists transactions_import_hash_idx
  on public.transactions (account_id, (raw_import_data ->> 'hash'))
  where is_imported and deleted_at is null;

-- p_rows / p_shares: same shapes as before (see 20260926090000_import_rule_sharing.sql).
-- Returns the number of imported lines actually inserted (mirror lines of a
-- transfer are not counted, skipped duplicates neither).
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

revoke execute on function public.import_transactions(jsonb, jsonb) from public, anon;
grant execute on function public.import_transactions(jsonb, jsonb) to authenticated;
