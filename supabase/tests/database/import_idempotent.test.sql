-- import_transactions() is idempotent. Run: supabase test db
--
-- Re-sending lines that are already recorded in the target account (double click,
-- network retry, two tabs) must insert nothing — nor a lone mirror line, nor a
-- second shared expense — while new lines of the same payload still go through.

begin;
select plan(13);

-- ---------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@test.local');

select set_config('t.space_a', public.personal_space_id('aaaaaaaa-0000-0000-0000-00000000000a')::text, false);
select set_config('t.s', 'c1000000-0000-4000-8000-000000000001', false);

insert into public.spaces (id, name, kind, created_by) values
  (current_setting('t.s')::uuid, 'Foyer', 'shared', 'aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.s')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'owner'),
  (current_setting('t.s')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'member');
select public.seed_default_categories(current_setting('t.s')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a');
select set_config('t.cat_s', (select id::text from public.categories
  where space_id = current_setting('t.s')::uuid and name = 'Logement'), false);

insert into public.accounts (id, space_id, user_id, name, type) values
  ('e1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'BNP', 'courant'),
  ('e1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'N26', 'courant');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

-- One imported line of account BNP (hash h-<n>).
create function pg_temp.line(p_hash text, p_amount int, p_account text default 'e1000000-0000-4000-8000-000000000001',
                             p_id text default null, p_transfer text default null, p_imported boolean default true)
returns jsonb language sql as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', p_id, 'space_id', current_setting('t.space_a'), 'user_id', 'aaaaaaaa-0000-0000-0000-00000000000a',
    'account_id', p_account, 'kind', case when p_amount < 0 then 'expense' else 'income' end,
    'amount_cents', p_amount, 'date', '2026-09-01', 'description', 'L-' || coalesce(p_hash, 'nohash'),
    'transfer_id', p_transfer, 'is_imported', p_imported,
    'raw_import_data', case when p_hash is null then null else jsonb_build_object('hash', p_hash) end))
$$;

-- ---------------------------------------------------------------
-- Plain lines
-- ---------------------------------------------------------------
select is(
  public.import_transactions(jsonb_build_array(pg_temp.line('h1', -100), pg_temp.line('h2', -200))),
  2, 'a first import inserts and counts its lines');

select is(
  public.import_transactions(jsonb_build_array(pg_temp.line('h1', -100), pg_temp.line('h2', -200))),
  0, 're-sending the same payload inserts nothing');

select is(
  (select count(*)::int from public.transactions where description like 'L-h%'),
  2, 'and the table still holds each line once');

select is(
  public.import_transactions(jsonb_build_array(pg_temp.line('h1', -100), pg_temp.line('h3', -300))),
  1, 'a payload mixing a known and a new line only inserts the new one');

select is(
  public.import_transactions(jsonb_build_array(pg_temp.line('h4', -400), pg_temp.line('h4', -400))),
  1, 'the same hash twice in one payload is inserted once');

select is(
  public.import_transactions(jsonb_build_array(pg_temp.line('h1', -100, 'e1000000-0000-4000-8000-000000000002'))),
  1, 'the same hash in another account is a different line');

select is(
  public.import_transactions(jsonb_build_array(pg_temp.line(null, -50), pg_temp.line(null, -50))),
  2, 'lines without a hash are never skipped');

select is(
  (select count(*)::int from public.transactions where description like 'L-nohash'),
  2, 'and were both inserted');

-- A deleted line can be imported again.
update public.transactions set deleted_at = now() where description = 'L-h2';
select is(
  public.import_transactions(jsonb_build_array(pg_temp.line('h2', -200))),
  1, 'a soft-deleted line can be imported again');

-- ---------------------------------------------------------------
-- Transfers: the mirror follows its line
-- ---------------------------------------------------------------
select public.import_transactions(jsonb_build_array(
  pg_temp.line('t1', -50000, 'e1000000-0000-4000-8000-000000000001', null, 'a1000000-0000-4000-8000-000000000001'),
  pg_temp.line(null, 50000, 'e1000000-0000-4000-8000-000000000002', null, 'a1000000-0000-4000-8000-000000000001', false)));

select is(
  public.import_transactions(jsonb_build_array(
    pg_temp.line('t1', -50000, 'e1000000-0000-4000-8000-000000000001', null, 'a1000000-0000-4000-8000-000000000001'),
    pg_temp.line(null, 50000, 'e1000000-0000-4000-8000-000000000002', null, 'a1000000-0000-4000-8000-000000000001', false))),
  0, 're-sending a transfer inserts nothing');

select is(
  (select count(*)::int from public.transactions where transfer_id = 'a1000000-0000-4000-8000-000000000001'),
  2, 'and its mirror line is not duplicated on its own');

-- ---------------------------------------------------------------
-- Shares: no second shared expense
-- ---------------------------------------------------------------
select public.import_transactions(
  jsonb_build_array(pg_temp.line('s1', -12000, 'e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001')),
  jsonb_build_array(jsonb_build_object('space_id', current_setting('t.s'),
    'source_transaction_id', 'd1000000-0000-4000-8000-000000000001', 'category_id', current_setting('t.cat_s'),
    'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 50, 'bbbbbbbb-0000-0000-0000-00000000000b', 50))));

select is(
  public.import_transactions(
    jsonb_build_array(pg_temp.line('s1', -12000, 'e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001')),
    jsonb_build_array(jsonb_build_object('space_id', current_setting('t.s'),
      'source_transaction_id', 'd1000000-0000-4000-8000-000000000001', 'category_id', current_setting('t.cat_s'),
      'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 50, 'bbbbbbbb-0000-0000-0000-00000000000b', 50)))),
  0, 're-sending a shared line inserts nothing and does not fail');

select is(
  (select count(*)::int from public.shared_expenses), 1, 'and it is still shared once');

select * from finish();
rollback;
