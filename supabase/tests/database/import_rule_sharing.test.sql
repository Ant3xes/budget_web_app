-- Import rules that share, and the atomic import. Run: supabase test db
--
-- A owns the shared space S, B is a member, C owns another shared space T that
-- A does not belong to.

begin;
select plan(28);

-- ---------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@test.local'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@test.local');

select set_config('t.space_a', public.personal_space_id('aaaaaaaa-0000-0000-0000-00000000000a')::text, false);
select set_config('t.space_b', public.personal_space_id('bbbbbbbb-0000-0000-0000-00000000000b')::text, false);
select set_config('t.s', 'c1000000-0000-4000-8000-000000000001', false);
select set_config('t.t', 'c2000000-0000-4000-8000-000000000002', false);

insert into public.spaces (id, name, kind, created_by) values
  (current_setting('t.s')::uuid, 'Foyer', 'shared', 'aaaaaaaa-0000-0000-0000-00000000000a'),
  (current_setting('t.t')::uuid, 'Autre', 'shared', 'cccccccc-0000-0000-0000-00000000000c');
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.s')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'owner'),
  (current_setting('t.s')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'member'),
  (current_setting('t.t')::uuid, 'cccccccc-0000-0000-0000-00000000000c', 'owner');
select public.seed_default_categories(current_setting('t.s')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a');
select public.seed_default_categories(current_setting('t.t')::uuid, 'cccccccc-0000-0000-0000-00000000000c');

select set_config('t.cat_s', (select id::text from public.categories
  where space_id = current_setting('t.s')::uuid and name = 'Logement'), false);
select set_config('t.cat_t', (select id::text from public.categories
  where space_id = current_setting('t.t')::uuid and name = 'Logement'), false);
select set_config('t.cat_a', (select id::text from public.categories
  where space_id = current_setting('t.space_a')::uuid and name = 'Logement'), false);

insert into public.accounts (id, space_id, user_id, name, type) values
  ('e1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte A', 'courant'),
  ('e1000000-0000-4000-8000-000000000002', current_setting('t.space_b')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'Compte B', 'courant');

-- ---------------------------------------------------------------
-- Rules that share
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.csv_import_rules (id, space_id, user_id, keyword, kind, category_id, share_space_id, share_category_id, share_payer_percent)
    values ('f1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid,
            'aaaaaaaa-0000-0000-0000-00000000000a', 'LOYER', 'expense', current_setting('t.cat_a')::uuid,
            current_setting('t.s')::uuid, current_setting('t.cat_s')::uuid, 60)$$,
  'a rule of a personal space can share into a shared space the author belongs to');

select is(
  (select share_payer_percent::int from public.csv_import_rules where id = 'f1000000-0000-4000-8000-000000000001'),
  60, 'the sharing settings are stored');

select throws_ok(
  $$insert into public.csv_import_rules (space_id, user_id, keyword, kind, share_space_id)
    values (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'SALAIRE', 'income', current_setting('t.s')::uuid)$$,
  '23514', null, 'an income rule cannot share');

select throws_ok(
  $$insert into public.csv_import_rules (space_id, user_id, keyword, kind, share_space_id)
    values (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'EDF', 'expense', current_setting('t.space_a')::uuid)$$,
  '23514', null, 'a rule cannot "share" into a personal space');

select throws_ok(
  $$insert into public.csv_import_rules (space_id, user_id, keyword, kind, share_space_id)
    values (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'EDF', 'expense', current_setting('t.t')::uuid)$$,
  '23514', null, 'a rule cannot share into a shared space its author does not belong to');

select throws_ok(
  $$insert into public.csv_import_rules (space_id, user_id, keyword, kind, share_space_id, share_category_id)
    values (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'EDF', 'expense',
            current_setting('t.s')::uuid, current_setting('t.cat_t')::uuid)$$,
  '23514', null, 'the common category must belong to the target space');

select throws_ok(
  $$insert into public.csv_import_rules (space_id, user_id, keyword, kind, share_space_id)
    values (current_setting('t.s')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'EDF', 'expense', current_setting('t.s')::uuid)$$,
  '23514', null, 'a rule living in a shared space cannot share');

select lives_ok(
  $$insert into public.csv_import_rules (id, space_id, user_id, keyword, kind, share_category_id, share_payer_percent)
    values ('f1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid,
            'aaaaaaaa-0000-0000-0000-00000000000a', 'NETFLIX', 'expense', null, null)$$,
  'a rule without a target space is a plain rule');

update public.csv_import_rules set share_category_id = current_setting('t.cat_s')::uuid, share_payer_percent = 30
  where id = 'f1000000-0000-4000-8000-000000000002';
select is(
  (select share_category_id from public.csv_import_rules where id = 'f1000000-0000-4000-8000-000000000002'),
  null, 'a category/percent without a target space is discarded, not stored');

select throws_ok(
  $$update public.csv_import_rules set kind = 'income' where id = 'f1000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a sharing rule cannot be turned into an income rule');


-- Deleting a category clears it from the rule without blocking the delete.
insert into public.categories (id, space_id, user_id, name, kind)
  values ('ca000000-0000-4000-8000-000000000001', current_setting('t.s')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Tmp', 'expense');
insert into public.csv_import_rules (id, space_id, user_id, keyword, kind, share_space_id, share_category_id)
  values ('f1000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid,
          'aaaaaaaa-0000-0000-0000-00000000000a', 'TMP', 'expense', current_setting('t.s')::uuid,
          'ca000000-0000-4000-8000-000000000001');

select lives_ok(
  $$delete from public.categories where id = 'ca000000-0000-4000-8000-000000000001'$$,
  'deleting the common category of a rule is not blocked');

select is(
  (select share_space_id::text || '/' || coalesce(share_category_id::text, 'none')
     from public.csv_import_rules where id = 'f1000000-0000-4000-8000-000000000003'),
  current_setting('t.s') || '/none', 'the rule keeps its target space and loses only the category');

-- ---------------------------------------------------------------
-- Atomic import
-- ---------------------------------------------------------------
select is(
  public.import_transactions(
    jsonb_build_array(
      jsonb_build_object('id', 'd1000000-0000-4000-8000-000000000001', 'space_id', current_setting('t.space_a'),
        'user_id', 'aaaaaaaa-0000-0000-0000-00000000000a', 'account_id', 'e1000000-0000-4000-8000-000000000001',
        'kind', 'expense', 'amount_cents', -12000, 'date', '2026-09-01', 'description', 'LOYER SEPTEMBRE',
        'is_imported', true, 'raw_import_data', jsonb_build_object('hash', 'h1')),
      jsonb_build_object('space_id', current_setting('t.space_a'), 'user_id', 'aaaaaaaa-0000-0000-0000-00000000000a',
        'account_id', 'e1000000-0000-4000-8000-000000000001', 'kind', 'expense', 'amount_cents', -900,
        'date', '2026-09-02', 'description', 'BOULANGERIE', 'is_imported', true)),
    jsonb_build_array(
      jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000001',
        'category_id', current_setting('t.cat_s'),
        'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 50, 'bbbbbbbb-0000-0000-0000-00000000000b', 50)))),
  2, 'the import inserts every transaction and returns their count');

select is(
  (select amount_cents from public.shared_expenses where source_transaction_id = 'd1000000-0000-4000-8000-000000000001'),
  12000, 'the flagged line is shared, with the amount filled from its transaction');

select is(
  (select count(*)::int from public.transactions where description = 'BOULANGERIE'),
  1, 'the line that is not shared is imported and stays personal');

select is(
  (select count(*)::int from public.shared_expenses), 1, 'only the flagged line was shared');

-- All or nothing: an invalid split rolls the whole import back.
select throws_ok(
  $$select public.import_transactions(
      jsonb_build_array(
        jsonb_build_object('id', 'd1000000-0000-4000-8000-000000000002', 'space_id', current_setting('t.space_a'),
          'user_id', 'aaaaaaaa-0000-0000-0000-00000000000a', 'account_id', 'e1000000-0000-4000-8000-000000000001',
          'kind', 'expense', 'amount_cents', -5000, 'date', '2026-09-03', 'description', 'ASSURANCE'),
        jsonb_build_object('space_id', current_setting('t.space_a'), 'user_id', 'aaaaaaaa-0000-0000-0000-00000000000a',
          'account_id', 'e1000000-0000-4000-8000-000000000001', 'kind', 'expense', 'amount_cents', -300,
          'date', '2026-09-03', 'description', 'CAFE')),
      jsonb_build_array(
        jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000002',
          'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 60, 'bbbbbbbb-0000-0000-0000-00000000000b', 60))))$$,
  '23514', null, 'an invalid split refuses the import');

select is(
  (select count(*)::int from public.transactions where description in ('ASSURANCE', 'CAFE')),
  0, 'and nothing was imported (not even the line that was fine)');

select throws_ok(
  $$select public.import_transactions(
      jsonb_build_array(
        jsonb_build_object('id', 'd1000000-0000-4000-8000-000000000003', 'space_id', current_setting('t.space_a'),
          'user_id', 'aaaaaaaa-0000-0000-0000-00000000000a', 'account_id', 'e1000000-0000-4000-8000-000000000001',
          'kind', 'income', 'amount_cents', 2000, 'date', '2026-09-03', 'description', 'REMBOURSEMENT')),
      jsonb_build_array(
        jsonb_build_object('space_id', current_setting('t.s'), 'source_transaction_id', 'd1000000-0000-4000-8000-000000000003',
          'shares', jsonb_build_object('aaaaaaaa-0000-0000-0000-00000000000a', 50, 'bbbbbbbb-0000-0000-0000-00000000000b', 50))))$$,
  '23514', null, 'an income cannot be shared through an import either');

select throws_ok(
  $$select public.import_transactions(
      jsonb_build_array(
        jsonb_build_object('space_id', current_setting('t.space_a'), 'user_id', 'bbbbbbbb-0000-0000-0000-00000000000b',
          'account_id', 'e1000000-0000-4000-8000-000000000001', 'kind', 'expense', 'amount_cents', -100,
          'date', '2026-09-03', 'description', 'USURPATION')))$$,
  '42501', null, 'an import cannot author rows as somebody else');

select throws_ok(
  $$select public.import_transactions(
      jsonb_build_array(
        jsonb_build_object('space_id', current_setting('t.space_b'), 'user_id', 'aaaaaaaa-0000-0000-0000-00000000000a',
          'account_id', 'e1000000-0000-4000-8000-000000000002', 'kind', 'expense', 'amount_cents', -100,
          'date', '2026-09-03', 'description', 'INTRUS')))$$,
  '23514', null, 'an import cannot write into another user''s space (the account is not even visible)');

select throws_ok(
  $$select public.import_transactions('{"not": "an array"}'::jsonb)$$,
  '22023', null, 'rows must be an array');

-- ---------------------------------------------------------------
-- What the partner sees, and who may call the function
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.shared_expenses), 1, 'the partner sees the shared line');

select is(
  (select count(*)::int from public.transactions where description in ('LOYER SEPTEMBRE', 'BOULANGERIE')),
  0, 'but none of the imported transactions');

reset role;
set local role anon;
select throws_ok(
  $$select public.import_transactions('[]'::jsonb)$$,
  '42501', null, 'the anonymous role cannot call the import');

reset role;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

-- Deleting the shared space clears the rule's target without blocking the delete.
select lives_ok(
  $$delete from public.spaces where id = current_setting('t.s')::uuid$$,
  'deleting a shared space is not blocked by the rules that target it');

select is(
  (select share_space_id from public.csv_import_rules where id = 'f1000000-0000-4000-8000-000000000001'),
  null, 'the rule stops targeting the deleted space');

select is(
  (select share_payer_percent from public.csv_import_rules where id = 'f1000000-0000-4000-8000-000000000001'),
  null, 'and its now-meaningless settings are cleared');

select * from finish();
rollback;
