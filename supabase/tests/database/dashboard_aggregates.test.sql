-- Dashboard aggregates (issue 162). Run: supabase test db
-- (not run in the agent environment: no Docker).
-- dashboard_category_totals, dashboard_monthly_totals, dashboard_account_totals,
-- dashboard_net_cents and dashboard_goal_category_totals return exact figures,
-- including past PostgREST's 1000-row response cap, net of linked reimbursements,
-- ignoring soft-deleted rows and accounts, and respecting RLS (security invoker).
begin;
select plan(24);

-- ---------------------------------------------------------------
-- Fixtures (as postgres)
-- ---------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000000a', 'a@test.local'),
  ('bbbbbbbb-0000-0000-0000-00000000000b', 'b@test.local');

select set_config('t.space_a', public.personal_space_id('aaaaaaaa-0000-0000-0000-00000000000a')::text, false);
select set_config('t.cat_c', (select id::text from public.categories
  where space_id = current_setting('t.space_a')::uuid and name = 'Logement' and kind = 'expense'), false);
select set_config('t.cat_d', (select id::text from public.categories
  where space_id = current_setting('t.space_a')::uuid and name = 'Transport' and kind = 'expense'), false);

-- D1 courant, D2 épargne (anchor 2026-09-30), D3 courant soft-deleted.
insert into public.accounts (id, space_id, user_id, name, type, balance_anchor_date, deleted_at) values
  ('d1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte D1', 'courant', '1900-01-01', null),
  ('d1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte D2', 'épargne', '2026-09-30', null),
  ('d1000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte D3', 'courant', '1900-01-01', now());

-- 1500 synthetic expenses of 10.00 EUR on D1 in October 2026 (category C), well past the 1000-row cap.
insert into public.transactions (space_id, user_id, account_id, kind, amount_cents, date, description, category_id)
select current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000001',
       'expense', -1000, '2026-10-05T12:00:00Z', 'Volume ' || g, current_setting('t.cat_c')::uuid
from generate_series(1, 1500) g;

insert into public.transactions (id, space_id, user_id, account_id, kind, amount_cents, date, description, category_id, deleted_at) values
  -- D1 income in September, expense in September (will be partly reimbursed), expense fully reimbursed
  ('d2000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'income', 200000, '2026-09-25T12:00:00Z', 'Salaire', null, null),
  ('d2000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'expense', -9000, '2026-09-10T12:00:00Z', 'Resto', current_setting('t.cat_d')::uuid, null),
  ('d2000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'expense', -2000, '2026-09-11T12:00:00Z', 'Cinéma', current_setting('t.cat_d')::uuid, null),
  -- soft-deleted transaction: ignored everywhere
  ('d2000000-0000-4000-8000-000000000004', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'expense', -77777, '2026-09-12T12:00:00Z', 'Supprimée', current_setting('t.cat_d')::uuid, now()),
  -- soft-deleted account D3: ignored everywhere
  ('d2000000-0000-4000-8000-000000000005', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000003', 'expense', -55555, '2026-09-12T12:00:00Z', 'Compte supprimé', current_setting('t.cat_d')::uuid, null),
  -- D2 savings: before anchor (not in balance), after anchor, in October
  ('d2000000-0000-4000-8000-000000000006', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000002', 'income', 40000, '2026-09-20T12:00:00Z', 'Avant ancre', null, null),
  ('d2000000-0000-4000-8000-000000000007', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000002', 'income', 30000, '2026-10-03T12:00:00Z', 'Dépôt', null, null);

-- Reimbursements (ADR 0004): 4000 back on Resto (-9000 -> net 5000), 2000 back on Cinéma (fully reimbursed -> disappears).
insert into public.transactions (space_id, user_id, account_id, kind, amount_cents, date, description, reimburses_transaction_id) values
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'income', 4000, '2026-09-28T12:00:00Z', 'Remb. resto', 'd2000000-0000-4000-8000-000000000002'),
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'd1000000-0000-4000-8000-000000000001', 'income', 2000, '2026-09-28T12:00:00Z', 'Remb. cinéma', 'd2000000-0000-4000-8000-000000000003');

-- Goal linked to category C (counts); goal linked to D but deleted (ignored).
insert into public.savings_goals (space_id, user_id, name, target_amount_cents, linked_category_id, deleted_at) values
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Objectif C', 100000, current_setting('t.cat_c')::uuid, null),
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Objectif D supprimé', 100000, current_setting('t.cat_d')::uuid, '2026-09-30T00:00:00Z');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

-- ---------------------------------------------------------------
-- dashboard_category_totals
-- ---------------------------------------------------------------
select is((select total_cents from public.dashboard_category_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-10-01', '2026-10-31')
  where category_id = current_setting('t.cat_c')::uuid and kind = 'expense'),
  1500000::bigint, 'category totals: 1500 expenses of 1000 cents = 1 500 000 (past the 1000-row cap)');
select is((select count(*)::int from public.dashboard_category_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-10-01', '2026-10-31')),
  1, 'category totals: October has a single (category, kind) group');
select is((select total_cents from public.dashboard_category_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-09-01', '2026-09-30')
  where category_id = current_setting('t.cat_d')::uuid and kind = 'expense'),
  5000::bigint, 'category totals: Resto counts for its net (9000 - 4000), Cinéma (fully reimbursed) disappears, deleted line and deleted account ignored');
select is((select total_cents from public.dashboard_category_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-09-01', '2026-09-30')
  where category_id is null and kind = 'income'),
  200000::bigint, 'category totals: income = salary only, linked reimbursements are not income');
select is((select name from public.dashboard_category_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-10-01', '2026-10-31')
  where category_id = current_setting('t.cat_c')::uuid),
  'Logement', 'category totals: carries the category name for the donut');
select is((select count(*)::int from public.dashboard_category_totals(current_setting('t.space_a')::uuid, 'courant', array['d1000000-0000-4000-8000-000000000002']::uuid[], '2026-09-01', '2026-10-31')),
  0, 'category totals: an account outside the scope returns nothing');
select is((select total_cents from public.dashboard_category_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-10-01', '2026-10-06')
  where kind = 'expense'),
  1500000::bigint, 'category totals: inclusive upper bound 6 October keeps the 5 October (noon) lines');
select is((select count(*)::int from public.dashboard_category_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-10-01', '2026-10-05', false)),
  0, 'category totals: exclusive bound at midnight 5 October drops the noon lines (midnight UTC comparison, as before)');

-- ---------------------------------------------------------------
-- dashboard_monthly_totals
-- ---------------------------------------------------------------
select is((select total_cents from public.dashboard_monthly_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-09-01', '2026-10-31')
  where month = '2026-10' and kind = 'expense'),
  1500000::bigint, 'monthly totals: October expenses = 1 500 000');
select is((select total_cents from public.dashboard_monthly_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-09-01', '2026-10-31')
  where month = '2026-09' and kind = 'expense'),
  5000::bigint, 'monthly totals: September expenses = 5000 net');
select is((select total_cents from public.dashboard_monthly_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-09-01', '2026-10-31')
  where month = '2026-09' and kind = 'income'),
  200000::bigint, 'monthly totals: September income = 200 000');
select is((select count(*)::int from public.dashboard_monthly_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-09-01', '2026-10-31')),
  3, 'monthly totals: one row per (month, kind) with data');

-- ---------------------------------------------------------------
-- dashboard_account_totals (anchor rule, ADR 0003; active accounts only)
-- ---------------------------------------------------------------
select is((select total_cents from public.dashboard_account_totals(current_setting('t.space_a')::uuid)
  where account_id = 'd1000000-0000-4000-8000-000000000001'),
  (1500 * -1000 + 200000 - 9000 - 2000 + 4000 + 2000)::bigint, 'account totals: D1 sums all 1507 live lines (exact past 1000 rows)');
select is((select total_cents from public.dashboard_account_totals(current_setting('t.space_a')::uuid)
  where account_id = 'd1000000-0000-4000-8000-000000000002'),
  30000::bigint, 'account totals: D2 ignores the line dated before its anchor');
select is((select count(*)::int from public.dashboard_account_totals(current_setting('t.space_a')::uuid)
  where account_id = 'd1000000-0000-4000-8000-000000000003'),
  0, 'account totals: a soft-deleted account is excluded');

-- ---------------------------------------------------------------
-- dashboard_net_cents ("Épargne ce mois")
-- ---------------------------------------------------------------
select is(public.dashboard_net_cents(current_setting('t.space_a')::uuid, 'non_courant', '2026-10-01', '2026-11-01'),
  30000::bigint, 'net cents: non-courant accounts, October, half-open window');
select is(public.dashboard_net_cents(current_setting('t.space_a')::uuid, 'non_courant', '2026-11-01', '2026-12-01'),
  0::bigint, 'net cents: an empty window gives 0, not null');
select is(public.dashboard_net_cents(current_setting('t.space_a')::uuid, 'courant', '2026-10-01', '2026-11-01'),
  -1500000::bigint, 'net cents: courant scope sums the 1500 October lines exactly');

-- ---------------------------------------------------------------
-- dashboard_goal_category_totals
-- ---------------------------------------------------------------
select is((select total_abs_cents from public.dashboard_goal_category_totals(current_setting('t.space_a')::uuid)
  where category_id = current_setting('t.cat_c')::uuid),
  1500000::bigint, 'goal totals: category C linked to a live goal, absolute amounts, exact past 1000 rows');
select is((select count(*)::int from public.dashboard_goal_category_totals(current_setting('t.space_a')::uuid)
  where category_id = current_setting('t.cat_d')::uuid),
  0, 'goal totals: a category linked only to a deleted goal is ignored');

-- ---------------------------------------------------------------
-- RLS and privileges
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.dashboard_category_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-09-01', '2026-10-31'))
  + (select count(*)::int from public.dashboard_monthly_totals(current_setting('t.space_a')::uuid, 'courant', null, '2026-09-01', '2026-10-31'))
  + (select count(*)::int from public.dashboard_account_totals(current_setting('t.space_a')::uuid))
  + (select count(*)::int from public.dashboard_goal_category_totals(current_setting('t.space_a')::uuid))
  + public.dashboard_net_cents(current_setting('t.space_a')::uuid, 'courant', '2026-09-01', '2026-11-01')::int,
  0, 'RLS: a non-member gets nothing from the dashboard functions');

reset role;
select is(has_function_privilege('anon', 'public.dashboard_category_totals(uuid, text, uuid[], date, date, boolean)', 'execute'),
  false, 'privileges: anon cannot execute the dashboard functions');
select is(has_function_privilege('authenticated', 'public.dashboard_category_totals(uuid, text, uuid[], date, date, boolean)', 'execute'),
  true, 'privileges: authenticated can execute them');
select is((select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'dashboard\_%' and p.prosecdef),
  0, 'security: every dashboard function is security invoker');

select * from finish();
rollback;
