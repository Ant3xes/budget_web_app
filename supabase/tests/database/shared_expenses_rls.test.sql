-- Shared expenses & settlements: access rules and integrity. Run: supabase test db
--
-- A owns the shared space S, B is a member, C is an outsider. Every check runs
-- under the `authenticated` role with that user's JWT claims (like PostgREST).

begin;
select plan(41);

-- ---------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@test.local'),
  ('cccccccc-0000-0000-0000-00000000000c', 'c@test.local');

select set_config('t.space_a', public.personal_space_id('aaaaaaaa-0000-0000-0000-00000000000a')::text, false);
select set_config('t.space_b', public.personal_space_id('bbbbbbbb-0000-0000-0000-00000000000b')::text, false);

insert into public.spaces (id, name, kind, created_by)
values ('c1000000-0000-4000-8000-000000000001', 'Foyer', 'shared', 'aaaaaaaa-0000-0000-0000-00000000000a');
insert into public.space_members (space_id, user_id, role) values
  ('c1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a', 'owner'),
  ('c1000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-0000-0000-00000000000b', 'member');
select public.seed_default_categories('c1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a');

select set_config('t.shared', 'c1000000-0000-4000-8000-000000000001', false);
select set_config('t.cat_s', (select id::text from public.categories
  where space_id = 'c1000000-0000-4000-8000-000000000001' and name = 'Logement'), false);
select set_config('t.cat_a', (select id::text from public.categories
  where space_id = current_setting('t.space_a')::uuid and name = 'Logement'), false);

insert into public.accounts (id, space_id, user_id, name, type) values
  ('e1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte A', 'courant'),
  ('e1000000-0000-4000-8000-000000000002', current_setting('t.space_b')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'Compte B', 'courant');

insert into public.transactions (id, space_id, user_id, account_id, kind, amount_cents, description, notes) values
  ('d1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -12000, 'Loyer', 'note secrète'),
  ('d1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -5000, 'Internet', null),
  ('d1000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -3000, 'Assurance', null),
  ('d1000000-0000-4000-8000-000000000004', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'income', 2000, 'Salaire', null),
  ('d1000000-0000-4000-8000-000000000005', current_setting('t.space_b')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'e1000000-0000-4000-8000-000000000002', 'income', 6000, 'Virement de A', null);

-- ---------------------------------------------------------------
-- A shares an expense
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$insert into public.shared_expenses (id, space_id, source_transaction_id, paid_by, amount_cents, description, category_id, shares)
    values ('f1000000-0000-4000-8000-000000000001', current_setting('t.shared')::uuid,
            'd1000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-0000-0000-00000000000a',
            1, 'Faux libellé', current_setting('t.cat_s')::uuid,
            '{"aaaaaaaa-0000-0000-0000-00000000000a": 50, "bbbbbbbb-0000-0000-0000-00000000000b": 50}')$$,
  'A can share an expense of their personal account into the shared space');

select is(
  (select amount_cents from public.shared_expenses where id = 'f1000000-0000-4000-8000-000000000001'),
  12000, 'the amount comes from the source transaction, not from the client');

select is(
  (select description from public.shared_expenses where id = 'f1000000-0000-4000-8000-000000000001'),
  'Loyer', 'the label comes from the source transaction, not from the client');

select lives_ok(
  $$insert into public.shared_expenses (id, space_id, source_transaction_id, paid_by, shares)
    values ('f1000000-0000-4000-8000-000000000003', current_setting('t.shared')::uuid,
            'd1000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-0000-0000-00000000000a',
            '{"aaaaaaaa-0000-0000-0000-00000000000a": 50, "bbbbbbbb-0000-0000-0000-00000000000b": 50}')$$,
  'the client does not have to send the amount: it is filled from the source');

select is(
  (select amount_cents from public.shared_expenses where id = 'f1000000-0000-4000-8000-000000000003'),
  3000, 'the filled-in amount is the source amount');

select throws_ok(
  $$insert into public.shared_expenses (space_id, source_transaction_id, paid_by, shares)
    values (current_setting('t.shared')::uuid, 'd1000000-0000-4000-8000-000000000001',
            'aaaaaaaa-0000-0000-0000-00000000000a',
            '{"aaaaaaaa-0000-0000-0000-00000000000a": 50, "bbbbbbbb-0000-0000-0000-00000000000b": 50}')$$,
  '23505', null, 'a transaction can only be shared once');

select throws_ok(
  $$insert into public.shared_expenses (space_id, source_transaction_id, paid_by, shares)
    values (current_setting('t.shared')::uuid, 'd1000000-0000-4000-8000-000000000004',
            'aaaaaaaa-0000-0000-0000-00000000000a',
            '{"aaaaaaaa-0000-0000-0000-00000000000a": 50, "bbbbbbbb-0000-0000-0000-00000000000b": 50}')$$,
  '23514', null, 'an income cannot be shared');

select throws_ok(
  $$insert into public.shared_expenses (space_id, source_transaction_id, paid_by, shares)
    values (current_setting('t.space_a')::uuid, 'd1000000-0000-4000-8000-000000000002',
            'aaaaaaaa-0000-0000-0000-00000000000a', '{"aaaaaaaa-0000-0000-0000-00000000000a": 100}')$$,
  '23514', null, 'an expense cannot be "shared" into a personal space');

select throws_ok(
  $$insert into public.shared_expenses (space_id, source_transaction_id, paid_by, shares)
    values (current_setting('t.shared')::uuid, 'd1000000-0000-4000-8000-000000000002',
            'aaaaaaaa-0000-0000-0000-00000000000a',
            '{"aaaaaaaa-0000-0000-0000-00000000000a": 60, "bbbbbbbb-0000-0000-0000-00000000000b": 60}')$$,
  '23514', null, 'shares that do not sum to 100 are refused');

select throws_ok(
  $$insert into public.shared_expenses (space_id, source_transaction_id, paid_by, shares)
    values (current_setting('t.shared')::uuid, 'd1000000-0000-4000-8000-000000000002',
            'aaaaaaaa-0000-0000-0000-00000000000a',
            '{"aaaaaaaa-0000-0000-0000-00000000000a": 50, "cccccccc-0000-0000-0000-00000000000c": 50}')$$,
  '23514', null, 'a share cannot be given to a non-member');

select throws_ok(
  $$insert into public.shared_expenses (space_id, source_transaction_id, paid_by, shares)
    values (current_setting('t.shared')::uuid, 'd1000000-0000-4000-8000-000000000002',
            'aaaaaaaa-0000-0000-0000-00000000000a', '{"bbbbbbbb-0000-0000-0000-00000000000b": 100}')$$,
  '23514', null, 'the payer must appear in the shares');

select throws_ok(
  $$insert into public.shared_expenses (space_id, source_transaction_id, paid_by, category_id, shares)
    values (current_setting('t.shared')::uuid, 'd1000000-0000-4000-8000-000000000002',
            'aaaaaaaa-0000-0000-0000-00000000000a', current_setting('t.cat_a')::uuid,
            '{"aaaaaaaa-0000-0000-0000-00000000000a": 50, "bbbbbbbb-0000-0000-0000-00000000000b": 50}')$$,
  '23514', null, 'the category must belong to the shared space');

select throws_ok(
  $$insert into public.shared_expenses (space_id, source_transaction_id, paid_by, shares)
    values (current_setting('t.shared')::uuid, 'd1000000-0000-4000-8000-000000000002',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            '{"aaaaaaaa-0000-0000-0000-00000000000a": 50, "bbbbbbbb-0000-0000-0000-00000000000b": 50}')$$,
  '23514', null, 'A cannot record an expense as paid by someone else');

select throws_ok(
  $$update public.shared_expenses set amount_cents = 1 where id = 'f1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'the amount of a shared expense cannot be edited by hand');

select lives_ok(
  $$update public.shared_expenses
    set shares = '{"aaaaaaaa-0000-0000-0000-00000000000a": 60, "bbbbbbbb-0000-0000-0000-00000000000b": 40}'
    where id = 'f1000000-0000-4000-8000-000000000001'$$,
  'the payer can change the split afterwards');

select throws_ok(
  $$update public.shared_expenses
    set shares = '{"aaaaaaaa-0000-0000-0000-00000000000a": 10}'
    where id = 'f1000000-0000-4000-8000-000000000001'$$,
  '23514', null, 'a changed split is validated too');

-- Default split per space
select lives_ok(
  $$update public.spaces set default_share_percent = 60 where id = current_setting('t.shared')::uuid$$,
  'the owner can change the default split');

select throws_ok(
  $$update public.spaces set default_share_percent = 150 where id = current_setting('t.shared')::uuid$$,
  '23514', null, 'the default split must stay within 0..100');

-- ---------------------------------------------------------------
-- B, the partner
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.shared_expenses where space_id = current_setting('t.shared')::uuid),
  2, 'B sees the shared expenses');

select is(
  (select count(*)::int from public.transactions where id = 'd1000000-0000-4000-8000-000000000001'),
  0, 'B cannot read the source transaction (account, notes, import data stay private)');

select is(
  (select count(*)::int from public.accounts where id = 'e1000000-0000-4000-8000-000000000001'),
  0, 'B cannot read the payer''s account');

update public.spaces set default_share_percent = 10 where id = current_setting('t.shared')::uuid;
select is(
  (select default_share_percent::int from public.spaces where id = current_setting('t.shared')::uuid),
  60, 'a plain member cannot change the default split');

update public.shared_expenses set category_id = null where id = 'f1000000-0000-4000-8000-000000000001';
select isnt(
  (select category_id from public.shared_expenses where id = 'f1000000-0000-4000-8000-000000000001'),
  null, 'B cannot change the payer''s expense');

delete from public.shared_expenses where id = 'f1000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.shared_expenses where id = 'f1000000-0000-4000-8000-000000000001'),
  1, 'B cannot unshare the payer''s expense');

select throws_ok(
  $$insert into public.shared_expenses (space_id, source_transaction_id, paid_by, shares)
    values (current_setting('t.shared')::uuid, 'd1000000-0000-4000-8000-000000000002',
            'bbbbbbbb-0000-0000-0000-00000000000b',
            '{"aaaaaaaa-0000-0000-0000-00000000000a": 50, "bbbbbbbb-0000-0000-0000-00000000000b": 50}')$$,
  '23514', null, 'B cannot share a transaction they cannot see');

-- ---------------------------------------------------------------
-- Settlements
-- ---------------------------------------------------------------
select lives_ok(
  $$insert into public.settlements (id, space_id, from_user, to_user, amount_cents, source_transaction_id, created_by)
    values ('a1000000-0000-4000-8000-000000000001', current_setting('t.shared')::uuid,
            'aaaaaaaa-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-00000000000b',
            1, 'd1000000-0000-4000-8000-000000000005', 'bbbbbbbb-0000-0000-0000-00000000000b')$$,
  'the receiver can record a settlement linked to the payment they received');

select is(
  (select amount_cents from public.settlements where id = 'a1000000-0000-4000-8000-000000000001'),
  6000, 'the settlement takes the amount of the received transaction');

select throws_ok(
  $$insert into public.settlements (space_id, from_user, to_user, source_transaction_id, created_by)
    values (current_setting('t.shared')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b', 'd1000000-0000-4000-8000-000000000005',
            'bbbbbbbb-0000-0000-0000-00000000000b')$$,
  '23505', null, 'a received payment settles only once');

select throws_ok(
  $$insert into public.settlements (space_id, from_user, to_user, amount_cents, created_by)
    values (current_setting('t.shared')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b',
            'bbbbbbbb-0000-0000-0000-00000000000b', 100, 'bbbbbbbb-0000-0000-0000-00000000000b')$$,
  '23514', null, 'nobody settles with themselves');

select throws_ok(
  $$insert into public.settlements (space_id, from_user, to_user, amount_cents, created_by)
    values (current_setting('t.shared')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b', 0, 'bbbbbbbb-0000-0000-0000-00000000000b')$$,
  '23514', null, 'a settlement amount must be positive');

select throws_ok(
  $$insert into public.settlements (space_id, from_user, to_user, amount_cents, created_by)
    values (current_setting('t.shared')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a',
            'cccccccc-0000-0000-0000-00000000000c', 100, 'bbbbbbbb-0000-0000-0000-00000000000b')$$,
  '23514', null, 'both parties must be members');

select throws_ok(
  $$insert into public.settlements (space_id, from_user, to_user, amount_cents, created_by)
    values (current_setting('t.shared')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a',
            'bbbbbbbb-0000-0000-0000-00000000000b', 100, 'aaaaaaaa-0000-0000-0000-00000000000a')$$,
  '42501', null, 'a settlement cannot be recorded in someone else''s name');

select throws_ok(
  $$update public.settlements set amount_cents = 1 where id = 'a1000000-0000-4000-8000-000000000001'$$,
  '42501', null, 'settlements cannot be edited');

-- ---------------------------------------------------------------
-- A sees the settlement but not the money that was received
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.settlements where space_id = current_setting('t.shared')::uuid),
  1, 'A sees the settlement');

select is(
  (select count(*)::int from public.transactions where id = 'd1000000-0000-4000-8000-000000000005'),
  0, 'A cannot read the transaction B received');

delete from public.settlements where id = 'a1000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.settlements where id = 'a1000000-0000-4000-8000-000000000001'),
  1, 'only the creator can delete a settlement');

-- ---------------------------------------------------------------
-- Source transaction changes flow to the shared copy
-- ---------------------------------------------------------------
update public.transactions set amount_cents = -15000, description = 'Loyer révisé'
  where id = 'd1000000-0000-4000-8000-000000000001';
select is(
  (select amount_cents from public.shared_expenses where id = 'f1000000-0000-4000-8000-000000000001'),
  15000, 'editing the source transaction updates the shared copy');

update public.transactions set deleted_at = now() where id = 'd1000000-0000-4000-8000-000000000001';
select is(
  (select count(*)::int from public.shared_expenses where id = 'f1000000-0000-4000-8000-000000000001'),
  0, 'soft-deleting the source transaction removes the shared copy');

-- ---------------------------------------------------------------
-- A co-member leaves: the payer can still edit their own transaction
-- ---------------------------------------------------------------
delete from public.space_members
  where space_id = current_setting('t.shared')::uuid and user_id = 'bbbbbbbb-0000-0000-0000-00000000000b';

select lives_ok(
  $$update public.transactions set amount_cents = -4000 where id = 'd1000000-0000-4000-8000-000000000003'$$,
  'editing a shared transaction still works after a co-member left (their frozen share stays)');

select is(
  (select amount_cents from public.shared_expenses where id = 'f1000000-0000-4000-8000-000000000003'),
  4000, 'and the shared copy follows the edit');

-- ---------------------------------------------------------------
-- Outsider
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000000c","role":"authenticated"}', true);

select is(
  (select count(*)::int from public.shared_expenses) + (select count(*)::int from public.settlements),
  0, 'an outsider sees neither shared expenses nor settlements');

select * from finish();
rollback;
