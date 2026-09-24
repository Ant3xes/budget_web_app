-- Retroactive sharing of existing expenses (follow-up of phase 4).
--
-- share_transactions() creates the shared_expenses of several already-existing
-- transactions in ONE SQL transaction: one invalid line (already shared, not
-- shareable, invalid split...) rolls the whole batch back.
--
-- SECURITY INVOKER on purpose, like import_transactions(): every insert goes
-- through the caller's RLS and the phase 2 triggers (prepare_shared_expense),
-- exactly as separate inserts would.
--
-- p_shares: array of {space_id, source_transaction_id, category_id?, shares}
-- Returns the number of shared expenses created.
create or replace function public.share_transactions(p_shares jsonb)
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

revoke execute on function public.share_transactions(jsonb) from public, anon;
grant execute on function public.share_transactions(jsonb) to authenticated;
