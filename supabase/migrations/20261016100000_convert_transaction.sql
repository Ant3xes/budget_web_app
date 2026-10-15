-- Issue 115: change the type of a transaction (expense / income / transfer)
-- atomically. The application computes the plan (lib/transactions/convert-transaction.ts);
-- this function applies it in one SQL transaction: update the edited row, soft-delete
-- the previous mirror line (if the row was a transfer) and create the new one.
-- SECURITY INVOKER: RLS and the space triggers apply as for direct writes.
-- Existing rows are untouched.

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

revoke execute on function public.convert_transaction(uuid, uuid, text, uuid, integer, date, text, uuid, text, text, uuid, integer) from public, anon;
grant execute on function public.convert_transaction(uuid, uuid, text, uuid, integer, date, text, uuid, text, text, uuid, integer) to authenticated;
