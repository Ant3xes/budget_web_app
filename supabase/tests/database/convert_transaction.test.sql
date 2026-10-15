-- convert_transaction() (issue 115): change the type of a transaction atomically.
-- Run: supabase test db (not run in the agent environment: no Docker).
begin;
select plan(19);

-- ---------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@test.local');

select set_config('t.space_a', public.personal_space_id('aaaaaaaa-0000-0000-0000-00000000000a')::text, false);
select set_config('t.space_b', public.personal_space_id('bbbbbbbb-0000-0000-0000-00000000000b')::text, false);
select set_config('t.cat_a', (select id::text from public.categories
  where space_id = current_setting('t.space_a')::uuid and name = 'Logement' and kind = 'expense'), false);

insert into public.accounts (id, space_id, user_id, name, type) values
  ('e1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte A1', 'courant'),
  ('e1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte A2', 'épargne'),
  ('e2000000-0000-4000-8000-000000000001', current_setting('t.space_b')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'Compte B1', 'courant');

insert into public.transactions (id, space_id, user_id, account_id, kind, amount_cents, date, description, transfer_id) values
  -- t1: expense -> income
  ('f1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -2000, '2026-09-10T12:00:00Z', 'Dépense 1', null),
  -- t2: income -> expense
  ('f1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'income', 5000, '2026-09-10T12:00:00Z', 'Revenu 2', null),
  -- t3: expense -> transfer (debit), then back to expense
  ('f1000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -3000, '2026-09-10T12:00:00Z', 'Dépense 3', null),
  -- t4: income -> transfer (credit)
  ('f1000000-0000-4000-8000-000000000004', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'income', 4000, '2026-09-10T12:00:00Z', 'Revenu 4', null),
  -- t5 + t5m: an existing transfer pair (used by the atomicity test)
  ('f1000000-0000-4000-8000-000000000005', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'transfer_debit', -1500, '2026-09-10T12:00:00Z', 'Virement 5', 'd1000000-0000-4000-8000-000000000005'),
  ('f1000000-0000-4000-8000-00000000005a', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000002', 'transfer_credit', 1500, '2026-09-10T12:00:00Z', 'Virement 5', 'd1000000-0000-4000-8000-000000000005'),
  -- tb: a transaction of the other user's space
  ('f2000000-0000-4000-8000-000000000001', current_setting('t.space_b')::uuid, 'bbbbbbbb-0000-0000-0000-00000000000b', 'e2000000-0000-4000-8000-000000000001', 'expense', -700, '2026-09-10T12:00:00Z', 'Dépense B', null);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

-- ---------------------------------------------------------------
-- expense -> income : the sign is inverted
-- ---------------------------------------------------------------
select public.convert_transaction('f1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'income',
  'e1000000-0000-4000-8000-000000000001', 2000, '2026-09-10'::date, 'Dépense 1', null::uuid, null::text);
select is((select kind || ':' || amount_cents from public.transactions where id = 'f1000000-0000-4000-8000-000000000001'),
  'income:2000', 'expense -> income: kind changes and the amount becomes positive');

-- ---------------------------------------------------------------
-- income -> expense
-- ---------------------------------------------------------------
select public.convert_transaction('f1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'expense',
  'e1000000-0000-4000-8000-000000000001', -5000, '2026-09-10'::date, 'Revenu 2', current_setting('t.cat_a')::uuid, 'note');
select is((select kind || ':' || amount_cents from public.transactions where id = 'f1000000-0000-4000-8000-000000000002'),
  'expense:-5000', 'income -> expense: kind changes and the amount becomes negative');
select is((select category_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000002'),
  current_setting('t.cat_a')::uuid, 'income -> expense: the category and the notes are applied');
select is((select notes from public.transactions where id = 'f1000000-0000-4000-8000-000000000002'),
  'note', 'income -> expense: the notes are applied');

-- ---------------------------------------------------------------
-- expense -> transfer : creates the mirror line
-- ---------------------------------------------------------------
select public.convert_transaction('f1000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'transfer_debit',
  'e1000000-0000-4000-8000-000000000001', -3000, '2026-09-10'::date, 'Dépense 3', null::uuid, null::text,
  'transfer_credit', 'e1000000-0000-4000-8000-000000000002', 3000);
select is((select kind || ':' || amount_cents from public.transactions where id = 'f1000000-0000-4000-8000-000000000003'),
  'transfer_debit:-3000', 'expense -> transfer: the edited row becomes the debit side');
select isnt((select transfer_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000003'), null,
  'expense -> transfer: the edited row gets a transfer_id');
select is((select count(*)::int from public.transactions
  where transfer_id = (select transfer_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000003')
    and deleted_at is null), 2,
  'expense -> transfer: exactly two lines share the transfer_id');
select is((select kind || ':' || amount_cents || ':' || account_id from public.transactions
  where id <> 'f1000000-0000-4000-8000-000000000003'
    and transfer_id = (select transfer_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000003')),
  'transfer_credit:3000:e1000000-0000-4000-8000-000000000002', 'expense -> transfer: the mirror is the credit side on the other account');
select is((select category_id from public.transactions where transfer_id = (select transfer_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000003') and category_id is not null limit 1),
  null, 'expense -> transfer: no line of the transfer has a category');

-- ---------------------------------------------------------------
-- income -> transfer : the signs follow the amount
-- ---------------------------------------------------------------
select public.convert_transaction('f1000000-0000-4000-8000-000000000004', current_setting('t.space_a')::uuid, 'transfer_credit',
  'e1000000-0000-4000-8000-000000000001', 4000, '2026-09-10'::date, 'Revenu 4', null::uuid, null::text,
  'transfer_debit', 'e1000000-0000-4000-8000-000000000002', -4000);
select is((select kind || ':' || amount_cents from public.transactions where id = 'f1000000-0000-4000-8000-000000000004'),
  'transfer_credit:4000', 'income -> transfer: the edited row becomes the credit side');
select is((select kind || ':' || amount_cents from public.transactions
  where id <> 'f1000000-0000-4000-8000-000000000004'
    and transfer_id = (select transfer_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000004')),
  'transfer_debit:-4000', 'income -> transfer: the mirror is the debit side');

-- ---------------------------------------------------------------
-- transfer -> expense : the mirror is soft-deleted
-- ---------------------------------------------------------------
select set_config('t.old_transfer', (select transfer_id::text from public.transactions where id = 'f1000000-0000-4000-8000-000000000003'), true);

select public.convert_transaction('f1000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'expense',
  'e1000000-0000-4000-8000-000000000001', -3000, '2026-09-10'::date, 'Dépense 3', current_setting('t.cat_a')::uuid, null::text);
select is((select kind || ':' || amount_cents from public.transactions where id = 'f1000000-0000-4000-8000-000000000003'),
  'expense:-3000', 'transfer -> expense: the edited row is a plain expense again');
select is((select transfer_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000003'), null,
  'transfer -> expense: the transfer_id is cleared');
select is((select category_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000003'),
  current_setting('t.cat_a')::uuid, 'transfer -> expense: the given category is applied');
select is((select count(*)::int from public.transactions
  where transfer_id = current_setting('t.old_transfer')::uuid and deleted_at is not null), 1,
  'transfer -> expense: the mirror line is soft-deleted');

-- ---------------------------------------------------------------
-- Refusals
-- ---------------------------------------------------------------
select throws_ok($$select public.convert_transaction('f2000000-0000-4000-8000-000000000001', current_setting('t.space_b')::uuid, 'income',
  'e2000000-0000-4000-8000-000000000001', 700, '2026-09-10'::date, 'Dépense B', null::uuid, null::text)$$,
  'P0002', null, 'a transaction of another space is not found');
select throws_ok($$select public.convert_transaction('f1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'expense',
  'e2000000-0000-4000-8000-000000000001', -2000, '2026-09-10'::date, 'x', null::uuid, null::text)$$,
  '23514', null, 'an account of another space is refused');

-- ---------------------------------------------------------------
-- Atomicity: the failing update rolls the mirror deletion back
-- ---------------------------------------------------------------
select throws_ok($$select public.convert_transaction('f1000000-0000-4000-8000-000000000005', current_setting('t.space_a')::uuid, 'expense',
  'e2000000-0000-4000-8000-000000000001', -1500, '2026-09-10'::date, 'x', null::uuid, null::text)$$,
  '23514', null, 'converting a transfer to a foreign account fails');
select is((select count(*)::int from public.transactions
  where transfer_id = 'd1000000-0000-4000-8000-000000000005' and deleted_at is null), 2,
  'after the failure both lines of the transfer are still there (nothing half done)');

select * from finish();
rollback;
