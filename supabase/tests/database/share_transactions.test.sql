-- Atomic retroactive sharing (share_transactions). Run: supabase test db
--
-- A owns the shared space S, B is a member. A has three expenses (t1, t2, t4)
-- and an income (t3) in the personal space; B has an expense (tb).

begin;
select plan(13);

-- ---------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@test.local');

select set_config('t.space_a', public.personal_space_id('aaaaaaaa-0000-0000-0000-00000000000a')::text, false);
select set_config('t.space_b', public.personal_space_id('bbbbbbbb-0000-0000-0000-00000000000b')::text, false);
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
  ('e1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte A', 'courant'),
  ('e1000000-0000-4000-8000-000000000002', current_setting('t.space_b')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'Compte B', 'courant');

insert into public.transactions (id, space_id, user_id, account_id, kind, amount_cents, date, description) values
  ('d1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -80000, '2026-06-01', 'LOYER JUIN'),
  ('d1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -80000, '2026-07-01', 'LOYER JUILLET'),
  ('d1000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'income', 150000, '2026-07-02', 'SALAIRE'),
  ('d1000000-0000-4000-8000-000000000004', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -80000, '2026-08-01', 'LOYER AOUT'),
  ('d1000000-0000-4000-8000-0000000000b1', current_setting('t.space_b')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'e1000000-0000-4000-8000-000000000002', 'expense', -5000, '2026-07-03', 'COURSES B');

-- ---------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.share_transactions(jsonb)', 'execute'),
  'authenticated can execute share_transactions');
select ok(
  not has_function_privilege('anon', 'public.share_transactions(jsonb)', 'execute'),
  'anon cannot execute share_transactions');

-- ---------------------------------------------------------------
-- Not signed in / malformed
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$select public.share_transactions('[]'::jsonb)$$,
  '28000', null, 'a caller without a user is refused');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select throws_ok(
  $$select public.share_transactions('{"not": "an array"}'::jsonb)$$,
  '22023', null, 'shares must be an array');

select is(public.share_transactions('[]'::jsonb), 0, 'an empty batch shares nothing');

-- ---------------------------------------------------------------
-- Success
-- ---------------------------------------------------------------
select is(
  public.share_transactions(jsonb_build_array(
    jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000001',
      'category_id', current_setting('t.cat_s'),
      'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 60, 'bbbbbbbb-0000-0000-0000-00000000000b', 40)),
    jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000002',
      'category_id', current_setting('t.cat_s'),
      'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 60, 'bbbbbbbb-0000-0000-0000-00000000000b', 40)))),
  2, 'two existing expenses are shared in one call');

select is(
  (select count(*)::int from public.shared_expenses
    where source_transaction_id in ('d1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000002')
      and paid_by = 'aaaaaaaa-0000-0000-0000-00000000000a'
      and amount_cents = 80000),
  2, 'paid_by is the caller and the amount comes from the source transaction');

-- ---------------------------------------------------------------
-- Atomicity
-- ---------------------------------------------------------------
select throws_ok(
  $$select public.share_transactions(jsonb_build_array(
      jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000004',
        'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 50, 'bbbbbbbb-0000-0000-0000-00000000000b', 50)),
      jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000003',
        'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 50, 'bbbbbbbb-0000-0000-0000-00000000000b', 50))))$$,
  '23514', null, 'a batch containing an income is refused');

select is(
  (select count(*)::int from public.shared_expenses where source_transaction_id = 'd1000000-0000-4000-8000-000000000004'),
  0, 'and the valid line of the same batch was rolled back too');

select throws_ok(
  $$select public.share_transactions(jsonb_build_array(
      jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000004',
        'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 70, 'bbbbbbbb-0000-0000-0000-00000000000b', 40))))$$,
  '23514', null, 'a split that does not add up to 100 is refused');

select throws_ok(
  $$select public.share_transactions(jsonb_build_array(
      jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000001',
        'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 50, 'bbbbbbbb-0000-0000-0000-00000000000b', 50))))$$,
  '23505', null, 'an already shared expense cannot be shared twice');

-- ---------------------------------------------------------------
-- RLS still applies (SECURITY INVOKER)
-- ---------------------------------------------------------------
select throws_ok(
  $$select public.share_transactions(jsonb_build_array(
      jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-0000000000b1',
        'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 50, 'bbbbbbbb-0000-0000-0000-00000000000b', 50))))$$,
  '23514', null, 'a caller cannot share a transaction of another user');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select throws_ok(
  $$select public.share_transactions(jsonb_build_array(
      jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000004',
        'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 50, 'bbbbbbbb-0000-0000-0000-00000000000b', 50))))$$,
  '23514', null, 'a member cannot share the personal expense of the other member');

select * from finish();
rollback;
