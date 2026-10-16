-- Linked reimbursements (ADR 0004, issue 123). Run: supabase test db
-- (not run in the agent environment: no Docker).
begin;
select plan(8);

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.local');
select set_config('t.space_a', public.personal_space_id('aaaaaaaa-0000-0000-0000-00000000000a')::text, false);

insert into public.accounts (id, space_id, user_id, name, type) values
  ('e1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte A', 'courant');

insert into public.transactions (id, space_id, user_id, account_id, kind, amount_cents, date, description) values
  ('f1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -9000, now(), 'Cadeau'),
  ('f1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'income', 2500, now(), 'Part 1'),
  ('f1000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'income', 3500, now(), 'Part 2'),
  ('f1000000-0000-4000-8000-000000000004', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -1000, now(), 'Autre dépense');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', false);
set local role authenticated;

update public.transactions set reimburses_transaction_id = 'f1000000-0000-4000-8000-000000000001'
  where id in ('f1000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000003');
select is((select count(*)::int from public.transactions where reimburses_transaction_id = 'f1000000-0000-4000-8000-000000000001'), 2,
  'an expense can have several reimbursements');

select throws_ok($$update public.transactions set reimburses_transaction_id = id where id = 'f1000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'no self reference');
select throws_ok($$update public.transactions set reimburses_transaction_id = 'f1000000-0000-4000-8000-000000000003' where id = 'f1000000-0000-4000-8000-000000000002'$$,
  '23514', null, 'the target must be an expense');
select throws_ok($$update public.transactions set reimburses_transaction_id = 'f1000000-0000-4000-8000-000000000001' where id = 'f1000000-0000-4000-8000-000000000004'$$,
  '23514', null, 'the source must be incoming');

-- Deleting a reimbursement: its link is cleared, the other one stays.
update public.transactions set deleted_at = now() where id = 'f1000000-0000-4000-8000-000000000003';
select is((select reimburses_transaction_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000003'), null,
  'a soft-deleted reimbursement loses its link');
select is((select count(*)::int from public.transactions where reimburses_transaction_id = 'f1000000-0000-4000-8000-000000000001' and deleted_at is null), 1,
  'the remaining reimbursement still counts');

-- Income turned into an expense: link cleared (convert_transaction path).
select lives_ok($$select public.convert_transaction('f1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'expense',
  'e1000000-0000-4000-8000-000000000001', -2500, current_date, 'Part 1', null, null)$$, 'convert_transaction still works on a linked income');
select is((select reimburses_transaction_id from public.transactions where id = 'f1000000-0000-4000-8000-000000000002'), null,
  'a converted source loses its link');

select * from finish();
rollback;
