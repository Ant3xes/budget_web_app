-- Issue 123 (ADR 0004): an incoming transaction (income / transfer_credit) can
-- reimburse ONE expense; an expense can have several reimbursements. The
-- expense then counts for max(0, |expense| - sum(reimbursements)) in every
-- expense/income aggregate (computed in lib/transactions/net-amount.ts).
-- Balances are untouched: the money really moved. Existing rows keep a null
-- link, hence their current behaviour. RLS is unchanged.

alter table public.transactions
  add column if not exists reimburses_transaction_id uuid references public.transactions(id) on delete set null;

-- No self-reference, and only a positive amount can reimburse.
alter table public.transactions
  add constraint transactions_reimburses_not_self
    check (reimburses_transaction_id is null or reimburses_transaction_id <> id),
  add constraint transactions_reimburses_positive
    check (reimburses_transaction_id is null or amount_cents > 0);

create index if not exists transactions_reimburses_idx
  on public.transactions (reimburses_transaction_id)
  where reimburses_transaction_id is not null;

-- The target must be an active expense of the same space and the source an
-- active incoming line. Only checked when the link is set or changed (a
-- `check` cannot read another row). Read under the caller's RLS.
create or replace function public.validate_transaction_reimbursement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_target public.transactions%rowtype;
begin
  if new.reimburses_transaction_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.reimburses_transaction_id is not distinct from old.reimburses_transaction_id then
    return new;
  end if;

  if new.kind not in ('income', 'transfer_credit') or new.amount_cents <= 0 or new.deleted_at is not null then
    raise exception 'only an incoming transaction can reimburse an expense' using errcode = '23514';
  end if;

  select * into v_target from public.transactions where id = new.reimburses_transaction_id;
  if not found or v_target.deleted_at is not null or v_target.kind <> 'expense'
     or v_target.amount_cents >= 0 or v_target.transfer_id is not null then
    raise exception 'the reimbursed transaction must be an active expense' using errcode = '23514';
  end if;
  if v_target.space_id <> new.space_id then
    raise exception 'the reimbursed expense must belong to the same space' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_validate_reimbursement
  before insert or update on public.transactions
  for each row execute function public.validate_transaction_reimbursement();

-- A source that is deleted or stops being incoming loses its link (runs before
-- the check, so convert_transaction keeps working). Name sorts before the
-- validation trigger; the link is then null and validation is skipped.
create or replace function public.clear_reimbursement_on_source_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reimburses_transaction_id is not null
     and (new.deleted_at is not null or new.kind not in ('income', 'transfer_credit') or new.amount_cents <= 0) then
    new.reimburses_transaction_id := null;
  end if;
  return new;
end;
$$;

create trigger transactions_a_clear_reimbursement
  before update on public.transactions
  for each row execute function public.clear_reimbursement_on_source_change();

-- A target that is deleted or stops being an expense frees its reimbursements
-- (they become plain income again).
create or replace function public.clear_reimbursements_on_target_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null or new.kind <> 'expense' or new.amount_cents >= 0 or new.transfer_id is not null then
    update public.transactions
    set reimburses_transaction_id = null
    where reimburses_transaction_id = new.id;
  end if;
  return null;
end;
$$;

revoke execute on function public.clear_reimbursements_on_target_change() from public, anon, authenticated;

create trigger transactions_clear_reimbursements
  after update of deleted_at, kind, amount_cents, transfer_id on public.transactions
  for each row execute function public.clear_reimbursements_on_target_change();

-- ------------------------------------------------------------
-- Shared expenses (ADR 0002): co-members cannot read the source transaction
-- nor its reimbursements, so the shared copy carries the reimbursed total.
-- ------------------------------------------------------------
alter table public.shared_expenses
  add column if not exists reimbursed_cents integer not null default 0 check (reimbursed_cents >= 0);

create or replace function public.reimbursed_total(p_expense_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(amount_cents), 0)::integer
  from public.transactions
  where reimburses_transaction_id = p_expense_id and deleted_at is null and amount_cents > 0
$$;

revoke execute on function public.reimbursed_total(uuid) from public, anon, authenticated;

create or replace function public.sync_shared_expense_reimbursed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  for v_id in
    select distinct x from unnest(array[
      new.reimburses_transaction_id,
      case when tg_op = 'UPDATE' then old.reimburses_transaction_id end
    ]) as x where x is not null
  loop
    update public.shared_expenses
    set reimbursed_cents = public.reimbursed_total(v_id)
    where source_transaction_id = v_id;
  end loop;
  return null;
end;
$$;

revoke execute on function public.sync_shared_expense_reimbursed() from public, anon, authenticated;

create trigger transactions_sync_shared_reimbursed
  after insert or update of reimburses_transaction_id, amount_cents, deleted_at, kind
  on public.transactions
  for each row execute function public.sync_shared_expense_reimbursed();

-- A copy created after the reimbursements start with the right total; the
-- client can never set it.
create or replace function public.init_shared_expense_reimbursed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.reimbursed_cents := public.reimbursed_total(new.source_transaction_id);
  return new;
end;
$$;

revoke execute on function public.init_shared_expense_reimbursed() from public, anon, authenticated;

create trigger shared_expenses_init_reimbursed
  before insert on public.shared_expenses
  for each row execute function public.init_shared_expense_reimbursed();
