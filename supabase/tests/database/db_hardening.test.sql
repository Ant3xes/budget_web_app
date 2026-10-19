-- Durcissement : catalogues, droits et écritures réelles sous JWT.
begin;
select plan(55);

select is((select count(*)::int from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'p')
    and not c.relrowsecurity
    and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass
      and d.objid = c.oid and d.deptype = 'e')),
  0, 'all public application tables have RLS enabled');

select is((select count(*)::int from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and (has_table_privilege('anon', c.oid, 'SELECT')
      or has_table_privilege('anon', c.oid, 'INSERT')
      or has_table_privilege('anon', c.oid, 'UPDATE')
      or has_table_privilege('anon', c.oid, 'DELETE'))
    and not exists (select 1 from pg_depend d where d.classid = 'pg_class'::regclass
      and d.objid = c.oid and d.deptype = 'e')),
  0, 'anon has no CRUD privileges on private tables');

select is((select count(*)::int from (select c.conrelid::regclass::text || '.' || c.conname
from pg_constraint c
where c.contype = 'f' and c.connamespace = 'public'::regnamespace
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid and i.indisvalid and i.indisready
      and i.indnkeyatts >= cardinality(c.conkey)
      and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey
      and (i.indpred is null or (
        cardinality(c.conkey) = 1 and pg_get_expr(i.indpred, i.indrelid) = (
          select format('(%I IS NOT NULL)', a.attname) from pg_attribute a
          where a.attrelid = c.conrelid and a.attnum = c.conkey[1]
        )
      ))
  )) missing),
  0, 'every public FK has a covering index (including non-null partial indexes)');

select has_index('public', 'invitations', 'invitations_space_id_idx', 'invitations_space_id_idx exists');

select has_index('public', 'csv_import_rules', 'csv_import_rules_category_id_idx', 'csv_import_rules_category_id_idx exists');

select has_index('public', 'invitations', 'invitations_inviter_user_id_idx', 'invitations_inviter_user_id_idx exists');

select has_index('public', 'invitations', 'invitations_accepted_by_user_id_idx', 'invitations_accepted_by_user_id_idx exists');

select has_index('public', 'accounts', 'accounts_user_id_idx', 'accounts_user_id_idx exists');

select has_index('public', 'categories', 'categories_user_id_idx', 'categories_user_id_idx exists');

select has_index('public', 'transactions', 'transactions_user_id_idx', 'transactions_user_id_idx exists');

select has_index('public', 'transactions', 'transactions_account_id_idx', 'transactions_account_id_idx exists');

select has_index('public', 'transactions', 'transactions_category_id_idx', 'transactions_category_id_idx exists');

select has_index('public', 'budgets', 'budgets_user_id_idx', 'budgets_user_id_idx exists');

select has_index('public', 'budgets', 'budgets_category_id_idx', 'budgets_category_id_idx exists');

select has_index('public', 'savings_goals', 'savings_goals_user_id_idx', 'savings_goals_user_id_idx exists');

select has_index('public', 'csv_import_rules', 'csv_import_rules_user_id_idx', 'csv_import_rules_user_id_idx exists');

select has_index('public', 'fixed_charges', 'fixed_charges_user_id_idx', 'fixed_charges_user_id_idx exists');

select has_index('public', 'fixed_charges', 'fixed_charges_account_id_idx', 'fixed_charges_account_id_idx exists');

select has_index('public', 'fixed_charges', 'fixed_charges_category_id_idx', 'fixed_charges_category_id_idx exists');

select has_index('public', 'savings_goals', 'savings_goals_linked_category_id_idx', 'savings_goals_linked_category_id_idx exists');

select has_index('public', 'spaces', 'spaces_created_by_idx', 'spaces_created_by_idx exists');

select has_index('public', 'shared_expenses', 'shared_expenses_paid_by_idx', 'shared_expenses_paid_by_idx exists');

select has_index('public', 'shared_expenses', 'shared_expenses_category_id_idx', 'shared_expenses_category_id_idx exists');

select has_index('public', 'settlements', 'settlements_from_user_idx', 'settlements_from_user_idx exists');

select has_index('public', 'settlements', 'settlements_to_user_idx', 'settlements_to_user_idx exists');

select has_index('public', 'settlements', 'settlements_created_by_idx', 'settlements_created_by_idx exists');

select has_index('public', 'csv_import_rules', 'csv_import_rules_share_space_id_idx', 'csv_import_rules_share_space_id_idx exists');

select has_index('public', 'csv_import_rules', 'csv_import_rules_share_category_id_idx', 'csv_import_rules_share_category_id_idx exists');

select ok(exists (select 1 from pg_indexes where schemaname = 'public'
  and indexname = 'transactions_space_account_date_idx'
  and indexdef like '%(space_id, account_id, date)%WHERE (deleted_at IS NULL)'),
  'existing active space/account/date index is reused without duplicate');

select ok(has_function_privilege('anon', 'public.get_space_invitation(text)', 'execute'),
  'public invitation preview RPC remains executable');

select is((select count(*)::int from pg_constraint where connamespace = 'public'::regnamespace
  and conname = any(array['accounts_currency_format', 'accounts_name_length', 'budgets_currency_format', 'categories_name_length', 'fixed_charges_currency_format', 'fixed_charges_name_length', 'fixed_charges_notes_length', 'profiles_default_currency_format', 'profiles_full_name_length', 'savings_goals_currency_format', 'savings_goals_name_length', 'shared_expenses_currency_format', 'shared_expenses_description_length', 'spaces_name_length', 'transactions_currency_format', 'transactions_description_length', 'transactions_notes_length'] ) and not convalidated),
  17, 'all new CHECK constraints are NOT VALID for existing rows');
-- Fixtures locales ; aucune donnée de production n'est lue.
insert into auth.users (id, email) values
  ('16900000-0000-0000-0000-000000000001', 'hardening-a@test.local'),
  ('16900000-0000-0000-0000-000000000002', 'hardening-b@test.local');
select set_config('t.space', public.personal_space_id('16900000-0000-0000-0000-000000000001')::text, true);
insert into public.accounts (id, space_id, user_id, name, type) values
  ('16910000-0000-0000-0000-000000000001', current_setting('t.space')::uuid,
   '16900000-0000-0000-0000-000000000001', 'Hardening', 'courant');
insert into public.categories (id, space_id, user_id, name, kind) values
  ('16920000-0000-0000-0000-000000000001', current_setting('t.space')::uuid,
   '16900000-0000-0000-0000-000000000001', 'Hardening', 'expense');
insert into public.transactions (space_id, user_id, account_id, kind, amount_cents) values
  (current_setting('t.space')::uuid, '16900000-0000-0000-0000-000000000001',
   '16910000-0000-0000-0000-000000000001', 'expense', -100);
insert into public.budgets (space_id, user_id, category_id, month, amount_cents) values
  (current_setting('t.space')::uuid, '16900000-0000-0000-0000-000000000001',
   '16920000-0000-0000-0000-000000000001', '2026-10-01', 10000);
insert into public.fixed_charges (space_id, user_id, name, amount_cents, frequency, next_due_date) values
  (current_setting('t.space')::uuid, '16900000-0000-0000-0000-000000000001',
   'Hardening', 100, 'monthly', '2026-11-01');
insert into public.savings_goals (space_id, user_id, name, target_amount_cents) values
  (current_setting('t.space')::uuid, '16900000-0000-0000-0000-000000000001', 'Hardening', 10000);
insert into public.csv_import_rules (space_id, user_id, keyword, kind) values
  (current_setting('t.space')::uuid, '16900000-0000-0000-0000-000000000001', 'hardening', 'expense');
select set_config('request.jwt.claims', '{"sub":"16900000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$update public.accounts set user_id = '16900000-0000-0000-0000-000000000002'
    where space_id = current_setting('t.space')::uuid$$,
  '23514', 'user_id cannot be changed', 'accounts: author is immutable');

select lives_ok(
  $$update public.accounts set user_id = user_id where space_id = current_setting('t.space')::uuid$$,
  'accounts: normal same-author update still succeeds');

select throws_ok(
  $$update public.categories set user_id = '16900000-0000-0000-0000-000000000002'
    where space_id = current_setting('t.space')::uuid$$,
  '23514', 'user_id cannot be changed', 'categories: author is immutable');

select lives_ok(
  $$update public.categories set user_id = user_id where space_id = current_setting('t.space')::uuid$$,
  'categories: normal same-author update still succeeds');

select throws_ok(
  $$update public.transactions set user_id = '16900000-0000-0000-0000-000000000002'
    where space_id = current_setting('t.space')::uuid$$,
  '23514', 'user_id cannot be changed', 'transactions: author is immutable');

select lives_ok(
  $$update public.transactions set user_id = user_id where space_id = current_setting('t.space')::uuid$$,
  'transactions: normal same-author update still succeeds');

select throws_ok(
  $$update public.budgets set user_id = '16900000-0000-0000-0000-000000000002'
    where space_id = current_setting('t.space')::uuid$$,
  '23514', 'user_id cannot be changed', 'budgets: author is immutable');

select lives_ok(
  $$update public.budgets set user_id = user_id where space_id = current_setting('t.space')::uuid$$,
  'budgets: normal same-author update still succeeds');

select throws_ok(
  $$update public.fixed_charges set user_id = '16900000-0000-0000-0000-000000000002'
    where space_id = current_setting('t.space')::uuid$$,
  '23514', 'user_id cannot be changed', 'fixed_charges: author is immutable');

select lives_ok(
  $$update public.fixed_charges set user_id = user_id where space_id = current_setting('t.space')::uuid$$,
  'fixed_charges: normal same-author update still succeeds');

select throws_ok(
  $$update public.savings_goals set user_id = '16900000-0000-0000-0000-000000000002'
    where space_id = current_setting('t.space')::uuid$$,
  '23514', 'user_id cannot be changed', 'savings_goals: author is immutable');

select lives_ok(
  $$update public.savings_goals set user_id = user_id where space_id = current_setting('t.space')::uuid$$,
  'savings_goals: normal same-author update still succeeds');

select throws_ok(
  $$update public.csv_import_rules set user_id = '16900000-0000-0000-0000-000000000002'
    where space_id = current_setting('t.space')::uuid$$,
  '23514', 'user_id cannot be changed', 'csv_import_rules: author is immutable');

select lives_ok(
  $$update public.csv_import_rules set user_id = user_id where space_id = current_setting('t.space')::uuid$$,
  'csv_import_rules: normal same-author update still succeeds');

select throws_ok(
  $$update public.accounts set currency = 'eur' where space_id = current_setting('t.space')::uuid$$,
  '23514', null, 'accounts.currency: invalid new value is rejected');

select throws_ok(
  $$update public.accounts set name = repeat('x', 201) where space_id = current_setting('t.space')::uuid$$,
  '23514', null, 'accounts.name: invalid new value is rejected');

select throws_ok(
  $$update public.transactions set description = repeat('x', 10001) where space_id = current_setting('t.space')::uuid$$,
  '23514', null, 'transactions.description: invalid new value is rejected');

select throws_ok(
  $$update public.transactions set notes = repeat('x', 10001) where space_id = current_setting('t.space')::uuid$$,
  '23514', null, 'transactions.notes: invalid new value is rejected');
reset role;
select set_config('request.jwt.claims', '{"sub":"16900000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;
select set_config('t.shared', public.create_shared_space('Hardening shared')::text, true);
insert into public.invitations (space_id, inviter_user_id, invitee_email, token) values
  (current_setting('t.shared')::uuid, '16900000-0000-0000-0000-000000000001', 'new@test.local', 'hardening-token');
reset role;
insert into public.space_members (space_id, user_id, role) values
  (current_setting('t.shared')::uuid, '16900000-0000-0000-0000-000000000002', 'member');
select set_config('request.jwt.claims', '{"sub":"16900000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
-- Dette explicite (ADR 0008) : contrat actuel conservé, pas de fausse preuve de secret.
select is((select token from public.invitations where space_id = current_setting('t.shared')::uuid),
  'hardening-token', 'compatibility: co-member token visibility remains deferred (ADR 0008)');
reset role;
set local role anon;
select throws_ok($$select token from public.invitations$$,
  '42501', null, 'anon cannot read invitation tokens from the private table');
select is((select space_name from public.get_space_invitation('hardening-token')),
  'Hardening shared', 'anon can still preview an invitation through the safe RPC');
reset role;
-- Les ACL globales et de schéma ne doivent pas redonner SELECT aux tables futures.
create table public.db_hardening_future (id integer);
select ok(not has_table_privilege('anon', 'public.db_hardening_future', 'SELECT')
  and not has_table_privilege('anon', 'public.db_hardening_future', 'INSERT')
  and not has_table_privilege('anon', 'public.db_hardening_future', 'UPDATE')
  and not has_table_privilege('anon', 'public.db_hardening_future', 'DELETE'),
  'new postgres-owned tables do not grant CRUD to anon');
select ok(has_table_privilege('authenticated', 'public.db_hardening_future', 'SELECT')
  and has_table_privilege('authenticated', 'public.db_hardening_future', 'INSERT')
  and has_table_privilege('authenticated', 'public.db_hardening_future', 'UPDATE')
  and has_table_privilege('authenticated', 'public.db_hardening_future', 'DELETE'),
  'new tables retain authenticated CRUD privileges');

select is((select count(*)::int from pg_default_acl d
  cross join lateral aclexplode(d.defaclacl) a
  where d.defaclobjtype = 'r'
    and d.defaclnamespace in (0, 'public'::regnamespace)
    and a.grantee = 'anon'::regrole
    and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')
    and pg_has_role(current_user, d.defaclrole, 'MEMBER')),
  0, 'manageable creators do not give anon default CRUD on future public tables');

select * from finish();
rollback;
