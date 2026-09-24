-- Shared expenses and settlements (phase 2 of multi-user support).
--
-- A member can share an expense paid from a *personal* account into a *shared*
-- space. The transaction stays in the personal space; what the co-members may
-- see lives in `shared_expenses` (label, amount, date, common category, payer,
-- split) — never the account, notes or import data of the source row. The
-- balance between members is derived from these rows and from `settlements`.

alter table public.spaces
  add column if not exists default_share_percent smallint not null default 50
    check (default_share_percent between 0 and 100);

-- ============================================================
-- 1. Shared expenses
-- ============================================================
create table public.shared_expenses (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  source_transaction_id uuid not null unique references public.transactions(id) on delete cascade,
  paid_by uuid not null references public.profiles(id) on delete cascade,
  -- amount / currency / date / description are copies of the source transaction,
  -- forced by prepare_shared_expense() and kept in sync by sync_shared_expense().
  amount_cents integer not null check (amount_cents > 0),
  currency char(3) not null default 'EUR',
  date timestamptz not null default timezone('utc', now()),
  description text,
  category_id uuid references public.categories(id) on delete set null,
  -- userId -> percent of the expense each member bears (sums to 100), frozen at share time.
  shares jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index shared_expenses_space_date_idx on public.shared_expenses(space_id, date desc);

create trigger shared_expenses_set_updated_at
  before update on public.shared_expenses
  for each row execute function public.set_updated_at();

create trigger shared_expenses_prevent_space_change
  before update on public.shared_expenses
  for each row execute function public.prevent_space_change();

alter table public.shared_expenses enable row level security;

create policy "shared_expenses_select_member" on public.shared_expenses
  for select using (public.is_space_member(space_id));
create policy "shared_expenses_insert_payer" on public.shared_expenses
  for insert with check (public.is_space_member(space_id) and paid_by = auth.uid());
create policy "shared_expenses_update_payer" on public.shared_expenses
  for update using (public.is_space_member(space_id) and paid_by = auth.uid())
  with check (public.is_space_member(space_id) and paid_by = auth.uid());
create policy "shared_expenses_delete_payer" on public.shared_expenses
  for delete using (public.is_space_member(space_id) and paid_by = auth.uid());

-- The payer can only change the category and the split afterwards; the amount,
-- label and date always mirror the source transaction.
revoke update on public.shared_expenses from anon, authenticated;
grant update (category_id, shares) on public.shared_expenses to authenticated;

-- Checks that `p_shares` is a valid split for `p_space_id`: an object of
-- userId -> non-negative percent, every key a member, the payer included,
-- summing to exactly 100.
create or replace function public.assert_valid_shares(p_space_id uuid, p_paid_by uuid, p_shares jsonb)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_key text;
  v_value numeric;
  v_sum numeric := 0;
begin
  if p_shares is null or jsonb_typeof(p_shares) <> 'object' then
    raise exception 'shares must be an object' using errcode = '23514';
  end if;

  for v_key, v_value in
    select key, value::numeric from jsonb_each_text(p_shares)
  loop
    if v_value < 0 then
      raise exception 'a share cannot be negative' using errcode = '23514';
    end if;
    if not exists (
      select 1 from public.space_members where space_id = p_space_id and user_id = v_key::uuid
    ) then
      raise exception 'share given to a non-member' using errcode = '23514';
    end if;
    v_sum := v_sum + v_value;
  end loop;

  if not (p_shares ? p_paid_by::text) then
    raise exception 'the payer must have a share' using errcode = '23514';
  end if;
  if v_sum <> 100 then
    raise exception 'shares must sum to 100' using errcode = '23514';
  end if;
end;
$$;

create or replace function public.prepare_shared_expense()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tx public.transactions%rowtype;
  v_source_kind text;
  v_category_space uuid;
begin
  if tg_op = 'INSERT' then
    -- Read under the caller's RLS: a transaction they cannot see cannot be shared.
    select * into v_tx from public.transactions where id = new.source_transaction_id;
    if not found or v_tx.deleted_at is not null or v_tx.kind <> 'expense'
       or v_tx.transfer_id is not null or v_tx.amount_cents >= 0 then
      raise exception 'source transaction is not a shareable expense' using errcode = '23514';
    end if;

    select kind into v_source_kind from public.spaces where id = v_tx.space_id;
    if v_source_kind is distinct from 'personal' then
      raise exception 'only expenses of a personal space can be shared' using errcode = '23514';
    end if;
    if not exists (select 1 from public.spaces where id = new.space_id and kind = 'shared') then
      raise exception 'expenses can only be shared into a shared space' using errcode = '23514';
    end if;
    if new.paid_by is distinct from v_tx.user_id then
      raise exception 'paid_by must be the author of the transaction' using errcode = '23514';
    end if;

    -- The snapshot always comes from the source, never from the client.
    new.amount_cents := -v_tx.amount_cents;
    new.currency := v_tx.currency;
    new.date := v_tx.date;
    new.description := v_tx.description;
  end if;

  -- Validate only what changed. sync_shared_expense() updates the copy when the
  -- source transaction is edited; it must keep working after a co-member left
  -- (their share stays in `shares`, frozen) or when the category was deleted.
  if new.category_id is not null and (tg_op = 'INSERT' or new.category_id is distinct from old.category_id) then
    select space_id into v_category_space from public.categories where id = new.category_id;
    if v_category_space is distinct from new.space_id then
      raise exception 'category belongs to another space' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'INSERT' or new.shares is distinct from old.shares then
    perform public.assert_valid_shares(new.space_id, new.paid_by, new.shares);
  end if;
  return new;
end;
$$;

create trigger shared_expenses_prepare
  before insert or update on public.shared_expenses
  for each row execute function public.prepare_shared_expense();

-- Keeps the shared copy aligned with its source transaction, or drops it when
-- the source stops being a shareable expense (soft-deleted, turned into a
-- transfer or an income). Runs as owner: the co-members cannot write the row.
create or replace function public.sync_shared_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null or new.kind <> 'expense'
     or new.transfer_id is not null or new.amount_cents >= 0 then
    delete from public.shared_expenses where source_transaction_id = new.id;
  else
    update public.shared_expenses
    set amount_cents = -new.amount_cents,
        currency = new.currency,
        date = new.date,
        description = new.description
    where source_transaction_id = new.id;
  end if;
  return null;
end;
$$;

revoke execute on function public.sync_shared_expense() from public, anon, authenticated;

create trigger transactions_sync_shared_expense
  after update of amount_cents, currency, date, description, deleted_at, kind, transfer_id
  on public.transactions
  for each row execute function public.sync_shared_expense();

-- ============================================================
-- 2. Settlements ("X paid Y back")
-- ============================================================
create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  date timestamptz not null default timezone('utc', now()),
  -- The money actually received (in the receiver's own account). Only the
  -- receiver can read that row; everyone else just sees the settlement.
  source_transaction_id uuid references public.transactions(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  check (from_user <> to_user)
);

create index settlements_space_date_idx on public.settlements(space_id, date desc);
create unique index settlements_one_per_source_idx
  on public.settlements(source_transaction_id) where source_transaction_id is not null;

alter table public.settlements enable row level security;

create policy "settlements_select_member" on public.settlements
  for select using (public.is_space_member(space_id));
create policy "settlements_insert_party" on public.settlements
  for insert with check (
    public.is_space_member(space_id)
    and created_by = auth.uid()
    and (from_user = auth.uid() or to_user = auth.uid())
  );
create policy "settlements_delete_creator" on public.settlements
  for delete using (public.is_space_member(space_id) and created_by = auth.uid());

-- Settlements are never edited: delete and record again.
revoke update on public.settlements from anon, authenticated;

create or replace function public.prepare_settlement()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_tx public.transactions%rowtype;
begin
  if not exists (select 1 from public.spaces where id = new.space_id and kind = 'shared') then
    raise exception 'settlements only exist in shared spaces' using errcode = '23514';
  end if;
  if not exists (select 1 from public.space_members where space_id = new.space_id and user_id = new.from_user)
     or not exists (select 1 from public.space_members where space_id = new.space_id and user_id = new.to_user) then
    raise exception 'both parties must be members of the space' using errcode = '23514';
  end if;

  if new.source_transaction_id is not null then
    -- Read under the caller's RLS; and only the receiver can link their own money.
    select * into v_tx from public.transactions where id = new.source_transaction_id;
    if not found or v_tx.deleted_at is not null
       or v_tx.kind not in ('income', 'transfer_credit') or v_tx.amount_cents <= 0 then
      raise exception 'source transaction is not a received payment' using errcode = '23514';
    end if;
    if new.to_user is distinct from v_tx.user_id then
      raise exception 'the receiver must be the owner of the received transaction' using errcode = '23514';
    end if;

    new.amount_cents := v_tx.amount_cents;
    new.date := v_tx.date;
  end if;

  return new;
end;
$$;

create trigger settlements_prepare
  before insert on public.settlements
  for each row execute function public.prepare_settlement();
