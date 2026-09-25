-- Data isolation (RLS) across every space-scoped table. Run with: supabase test db
--
-- Two unrelated users: A owns data in their personal space, B is an outsider
-- (no shared space). For each table we check, as B, that A's rows are
-- invisible, cannot be modified or deleted, and that B cannot insert into A's
-- space; as A, that the same rows ARE visible (so a passing test can't just
-- mean "everything is blocked"); and, as the table owner, that A's data is
-- untouched afterwards. Same idea for profiles.
--
-- Generated once from a template; edit the SQL directly to extend it.

begin;
select plan(46);

-- ---------------------------------------------------------------
-- Fixtures (as postgres). The sign-up trigger creates each profile,
-- personal space and default categories.
-- ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-1111-0000-0000-00000000000a', 'iso-a@test.local'),
  ('bbbbbbbb-1111-0000-0000-00000000000b', 'iso-b@test.local');

select set_config('t.space_a', public.personal_space_id('aaaaaaaa-1111-0000-0000-00000000000a')::text, false);

update public.profiles set full_name = 'Alice' where id = 'aaaaaaaa-1111-0000-0000-00000000000a';

insert into public.categories (id, space_id, user_id, name, kind)
values ('a0000000-0000-4000-8000-0000000000c0', current_setting('t.space_a')::uuid, 'aaaaaaaa-1111-0000-0000-00000000000a', 'Cat A', 'expense');
select set_config('t.cat_a', 'a0000000-0000-4000-8000-0000000000c0', false);

insert into public.accounts (id, space_id, user_id, name, type)
values ('a1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-1111-0000-0000-00000000000a', 'Compte A', 'courant');

insert into public.transactions (id, space_id, user_id, account_id, category_id, kind, amount_cents, description)
values ('a2000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-1111-0000-0000-00000000000a',
        'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000c0', 'expense', -1000, 'Tx A');

insert into public.budgets (id, space_id, user_id, category_id, month, amount_cents)
values ('a3000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'aaaaaaaa-1111-0000-0000-00000000000a', 'a0000000-0000-4000-8000-0000000000c0', date '2026-01-01', 50000);

insert into public.fixed_charges (id, space_id, user_id, name, amount_cents, frequency, next_due_date)
values ('a4000000-0000-4000-8000-000000000004', current_setting('t.space_a')::uuid, 'aaaaaaaa-1111-0000-0000-00000000000a', 'Charge A', 1000, 'monthly', date '2026-02-01');

insert into public.savings_goals (id, space_id, user_id, name, target_amount_cents)
values ('a5000000-0000-4000-8000-000000000005', current_setting('t.space_a')::uuid, 'aaaaaaaa-1111-0000-0000-00000000000a', 'Objectif A', 100000);

insert into public.csv_import_rules (id, space_id, user_id, keyword, category_id, kind)
values ('a6000000-0000-4000-8000-000000000006', current_setting('t.space_a')::uuid, 'aaaaaaaa-1111-0000-0000-00000000000a', 'A-RULE', 'a0000000-0000-4000-8000-0000000000c0', 'expense');


-- ---------------------------------------------------------------
-- Control: A sees their own rows
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-1111-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.accounts where id = 'a1000000-0000-4000-8000-000000000001'), 1, 'control: A can read their own accounts row');
select is((select count(*)::int from public.categories where id = 'a0000000-0000-4000-8000-0000000000c0'), 1, 'control: A can read their own categories row');
select is((select count(*)::int from public.transactions where id = 'a2000000-0000-4000-8000-000000000002'), 1, 'control: A can read their own transactions row');
select is((select count(*)::int from public.budgets where id = 'a3000000-0000-4000-8000-000000000003'), 1, 'control: A can read their own budgets row');
select is((select count(*)::int from public.fixed_charges where id = 'a4000000-0000-4000-8000-000000000004'), 1, 'control: A can read their own fixed_charges row');
select is((select count(*)::int from public.savings_goals where id = 'a5000000-0000-4000-8000-000000000005'), 1, 'control: A can read their own savings_goals row');
select is((select count(*)::int from public.csv_import_rules where id = 'a6000000-0000-4000-8000-000000000006'), 1, 'control: A can read their own csv_import_rules row');

reset role;

-- ---------------------------------------------------------------
-- B (outsider) tries to read / change / delete / insert into A's data
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-1111-0000-0000-00000000000b","role":"authenticated"}', true);
set local role authenticated;


-- accounts
select is((select count(*)::int from public.accounts where id = 'a1000000-0000-4000-8000-000000000001'), 0, 'B cannot read A''s accounts row');
select lives_ok($$update public.accounts set name = 'pwned' where id = 'a1000000-0000-4000-8000-000000000001'$$, 'B''s update of A''s accounts row is a silent no-op');
select lives_ok($$delete from public.accounts where id = 'a1000000-0000-4000-8000-000000000001'$$, 'B''s delete of A''s accounts row is a silent no-op');
select throws_ok($$insert into public.accounts (space_id, user_id, name, type) values (current_setting('t.space_a')::uuid, 'bbbbbbbb-1111-0000-0000-00000000000b', 'intrus', 'courant')$$, '42501', null, 'B cannot insert into A''s space (accounts, rejected by RLS)');

-- categories
select is((select count(*)::int from public.categories where id = 'a0000000-0000-4000-8000-0000000000c0'), 0, 'B cannot read A''s categories row');
select lives_ok($$update public.categories set name = 'pwned' where id = 'a0000000-0000-4000-8000-0000000000c0'$$, 'B''s update of A''s categories row is a silent no-op');
select lives_ok($$delete from public.categories where id = 'a0000000-0000-4000-8000-0000000000c0'$$, 'B''s delete of A''s categories row is a silent no-op');
select throws_ok($$insert into public.categories (space_id, user_id, name, kind) values (current_setting('t.space_a')::uuid, 'bbbbbbbb-1111-0000-0000-00000000000b', 'intrus', 'expense')$$, '42501', null, 'B cannot insert into A''s space (categories, rejected by RLS)');

-- transactions
select is((select count(*)::int from public.transactions where id = 'a2000000-0000-4000-8000-000000000002'), 0, 'B cannot read A''s transactions row');
select lives_ok($$update public.transactions set description = 'pwned' where id = 'a2000000-0000-4000-8000-000000000002'$$, 'B''s update of A''s transactions row is a silent no-op');
select lives_ok($$delete from public.transactions where id = 'a2000000-0000-4000-8000-000000000002'$$, 'B''s delete of A''s transactions row is a silent no-op');
-- A BEFORE INSERT trigger rejects references (account/category) that B cannot see,
-- before the RLS WITH CHECK is even evaluated: a second layer of defense.
select throws_ok($$insert into public.transactions (space_id, user_id, account_id, kind, amount_cents) values (current_setting('t.space_a')::uuid, 'bbbbbbbb-1111-0000-0000-00000000000b', 'a1000000-0000-4000-8000-000000000001', 'expense', -100)$$, '23514', null, 'B cannot insert into A''s space (transactions, rejected by the same-space trigger)');

-- budgets
select is((select count(*)::int from public.budgets where id = 'a3000000-0000-4000-8000-000000000003'), 0, 'B cannot read A''s budgets row');
select lives_ok($$update public.budgets set amount_cents = 1 where id = 'a3000000-0000-4000-8000-000000000003'$$, 'B''s update of A''s budgets row is a silent no-op');
select lives_ok($$delete from public.budgets where id = 'a3000000-0000-4000-8000-000000000003'$$, 'B''s delete of A''s budgets row is a silent no-op');
-- A BEFORE INSERT trigger rejects references (account/category) that B cannot see,
-- before the RLS WITH CHECK is even evaluated: a second layer of defense.
select throws_ok($$insert into public.budgets (space_id, user_id, category_id, month, amount_cents) values (current_setting('t.space_a')::uuid, 'bbbbbbbb-1111-0000-0000-00000000000b', current_setting('t.cat_a')::uuid, date '2026-03-01', 100)$$, '23514', null, 'B cannot insert into A''s space (budgets, rejected by the same-space trigger)');

-- fixed_charges
select is((select count(*)::int from public.fixed_charges where id = 'a4000000-0000-4000-8000-000000000004'), 0, 'B cannot read A''s fixed_charges row');
select lives_ok($$update public.fixed_charges set name = 'pwned' where id = 'a4000000-0000-4000-8000-000000000004'$$, 'B''s update of A''s fixed_charges row is a silent no-op');
select lives_ok($$delete from public.fixed_charges where id = 'a4000000-0000-4000-8000-000000000004'$$, 'B''s delete of A''s fixed_charges row is a silent no-op');
select throws_ok($$insert into public.fixed_charges (space_id, user_id, name, amount_cents, frequency, next_due_date) values (current_setting('t.space_a')::uuid, 'bbbbbbbb-1111-0000-0000-00000000000b', 'intrus', 100, 'monthly', date '2026-03-01')$$, '42501', null, 'B cannot insert into A''s space (fixed_charges, rejected by RLS)');

-- savings_goals
select is((select count(*)::int from public.savings_goals where id = 'a5000000-0000-4000-8000-000000000005'), 0, 'B cannot read A''s savings_goals row');
select lives_ok($$update public.savings_goals set name = 'pwned' where id = 'a5000000-0000-4000-8000-000000000005'$$, 'B''s update of A''s savings_goals row is a silent no-op');
select lives_ok($$delete from public.savings_goals where id = 'a5000000-0000-4000-8000-000000000005'$$, 'B''s delete of A''s savings_goals row is a silent no-op');
select throws_ok($$insert into public.savings_goals (space_id, user_id, name, target_amount_cents) values (current_setting('t.space_a')::uuid, 'bbbbbbbb-1111-0000-0000-00000000000b', 'intrus', 100)$$, '42501', null, 'B cannot insert into A''s space (savings_goals, rejected by RLS)');

-- csv_import_rules
select is((select count(*)::int from public.csv_import_rules where id = 'a6000000-0000-4000-8000-000000000006'), 0, 'B cannot read A''s csv_import_rules row');
select lives_ok($$update public.csv_import_rules set keyword = 'pwned' where id = 'a6000000-0000-4000-8000-000000000006'$$, 'B''s update of A''s csv_import_rules row is a silent no-op');
select lives_ok($$delete from public.csv_import_rules where id = 'a6000000-0000-4000-8000-000000000006'$$, 'B''s delete of A''s csv_import_rules row is a silent no-op');
-- A BEFORE INSERT trigger rejects references (account/category) that B cannot see,
-- before the RLS WITH CHECK is even evaluated: a second layer of defense.
select throws_ok($$insert into public.csv_import_rules (space_id, user_id, keyword, category_id, kind) values (current_setting('t.space_a')::uuid, 'bbbbbbbb-1111-0000-0000-00000000000b', 'intrus', current_setting('t.cat_a')::uuid, 'expense')$$, '23514', null, 'B cannot insert into A''s space (csv_import_rules, rejected by the same-space trigger)');

-- profiles
select is((select count(*)::int from public.profiles where id = 'aaaaaaaa-1111-0000-0000-00000000000a'), 0, 'B cannot read A''s profile (no shared space)');
select is((select count(*)::int from public.profiles where id = 'bbbbbbbb-1111-0000-0000-00000000000b'), 1, 'control: B can read their own profile');
select lives_ok($$update public.profiles set full_name = 'pwned' where id = 'aaaaaaaa-1111-0000-0000-00000000000a'$$, 'B''s update of A''s profile is a silent no-op');

reset role;

-- ---------------------------------------------------------------
-- Integrity (as postgres): none of A's data was touched
-- ---------------------------------------------------------------

select is((select name::text from public.accounts where id = 'a1000000-0000-4000-8000-000000000001'), 'Compte A', 'A''s accounts row is intact');
select is((select name::text from public.categories where id = 'a0000000-0000-4000-8000-0000000000c0'), 'Cat A', 'A''s categories row is intact');
select is((select description::text from public.transactions where id = 'a2000000-0000-4000-8000-000000000002'), 'Tx A', 'A''s transactions row is intact');
select is((select amount_cents::text from public.budgets where id = 'a3000000-0000-4000-8000-000000000003'), '50000', 'A''s budgets row is intact');
select is((select name::text from public.fixed_charges where id = 'a4000000-0000-4000-8000-000000000004'), 'Charge A', 'A''s fixed_charges row is intact');
select is((select name::text from public.savings_goals where id = 'a5000000-0000-4000-8000-000000000005'), 'Objectif A', 'A''s savings_goals row is intact');
select is((select keyword::text from public.csv_import_rules where id = 'a6000000-0000-4000-8000-000000000006'), 'A-RULE', 'A''s csv_import_rules row is intact');
select is((select full_name from public.profiles where id = 'aaaaaaaa-1111-0000-0000-00000000000a'), 'Alice', 'A''s profile is intact');

select * from finish();
rollback;
