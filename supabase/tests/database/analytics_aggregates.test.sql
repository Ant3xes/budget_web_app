-- Analytics aggregates (issue 121). Run: supabase test db
-- (not run in the agent environment: no Docker).
-- analytics_account_monthly_deltas, analytics_account_balances and
-- analytics_goal_category_monthly return exact figures on a known dataset,
-- ignore soft-deleted rows and respect RLS (security invoker).
begin;
select plan(17);

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

-- A1: anchor 2026-08-31. A2: anchor far in the past. A3: no transaction.
insert into public.accounts (id, space_id, user_id, name, type, balance_anchor_date) values
  ('e1000000-0000-4000-8000-000000000001', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte A1', 'courant', '2026-08-31'),
  ('e1000000-0000-4000-8000-000000000002', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte A2', 'epargne', '1900-01-01'),
  ('e1000000-0000-4000-8000-000000000003', current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Compte A3', 'courant', '1900-01-01');

insert into public.transactions (space_id, user_id, account_id, kind, amount_cents, date, description, category_id, deleted_at) values
  -- A1, on the anchor day: not counted in balances (strictly after the anchor)
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -1000, '2026-08-31T12:00:00Z', 'Avant ancre', current_setting('t.cat_c')::uuid, null),
  -- A1, September
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -2000, '2026-09-05T12:00:00Z', 'Sept dépense', current_setting('t.cat_c')::uuid, null),
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'income', 10000, '2026-09-20T12:00:00Z', 'Sept revenu', null, null),
  -- A1, October (after "today")
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -500, '2026-10-02T12:00:00Z', 'Oct dépense', current_setting('t.cat_c')::uuid, null),
  -- A1, soft-deleted: ignored everywhere
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000001', 'expense', -9999, '2026-09-06T12:00:00Z', 'Supprimée', current_setting('t.cat_c')::uuid, '2026-09-07T00:00:00Z'),
  -- A2, September, category without goal
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'e1000000-0000-4000-8000-000000000002', 'income', 300, '2026-09-15T12:00:00Z', 'Intérêts', current_setting('t.cat_d')::uuid, null);

-- Goal linked to category C (counts); goal linked to D but deleted (ignored).
insert into public.savings_goals (space_id, user_id, name, target_amount_cents, linked_category_id, deleted_at) values
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Objectif C', 100000, current_setting('t.cat_c')::uuid, null),
  (current_setting('t.space_a')::uuid, 'aaaaaaaa-0000-0000-0000-00000000000a', 'Objectif D supprimé', 100000, current_setting('t.cat_d')::uuid, '2026-09-30T00:00:00Z');

select set_config('t.ids', 'array[''e1000000-0000-4000-8000-000000000001'',''e1000000-0000-4000-8000-000000000002'',''e1000000-0000-4000-8000-000000000003'']::uuid[]', false);

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

-- ---------------------------------------------------------------
-- analytics_account_monthly_deltas
-- ---------------------------------------------------------------
select is((select count(*)::int from public.analytics_account_monthly_deltas(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000003']::uuid[])),
  3, 'deltas: one row per (account, month) with data; empty accounts give nothing');
select is((select total_cents from public.analytics_account_monthly_deltas(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001']::uuid[]) where month = '2026-09'),
  8000::bigint, 'deltas: A1 September = -2000 + 10000, deleted line and anchor-day line ignored');
select is((select total_cents from public.analytics_account_monthly_deltas(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001']::uuid[]) where month = '2026-10'),
  -500::bigint, 'deltas: A1 October = -500 (no upper date bound)');
select is((select count(*)::int from public.analytics_account_monthly_deltas(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001']::uuid[]) where month = '2026-08'),
  0, 'deltas: a month entirely before the anchor is empty');
select is((select total_cents from public.analytics_account_monthly_deltas(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000002']::uuid[]) where month = '2026-09'),
  300::bigint, 'deltas: A2 September = 300');
select is((select count(*)::int from public.analytics_account_monthly_deltas(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000003']::uuid[])),
  0, 'deltas: an account without transaction returns no row');
select is((select count(*)::int from public.analytics_account_monthly_deltas(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001']::uuid[]) where month = '2026-07'),
  0, 'deltas: an empty month returns no row');

-- ---------------------------------------------------------------
-- analytics_account_balances (today = 2026-10-01, window ends 2026-09-10)
-- ---------------------------------------------------------------
select is((select today_cents from public.analytics_account_balances(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002']::uuid[], '2026-10-01'::date, '2026-09-10'::date)
  where account_id = 'e1000000-0000-4000-8000-000000000001'),
  8000::bigint, 'balances: A1 today_cents = 8000 (October line is after today, anchor-day and deleted lines ignored)');
select is((select window_cents from public.analytics_account_balances(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002']::uuid[], '2026-10-01'::date, '2026-09-10'::date)
  where account_id = 'e1000000-0000-4000-8000-000000000001'),
  -2000::bigint, 'balances: A1 window_cents = -2000 (only lines before the window end)');
select is((select today_cents from public.analytics_account_balances(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000002']::uuid[], '2026-10-01'::date, '2026-09-10'::date)),
  300::bigint, 'balances: A2 today_cents = 300');
select is((select window_cents from public.analytics_account_balances(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000002']::uuid[], '2026-10-01'::date, '2026-09-10'::date)),
  0::bigint, 'balances: A2 window_cents = 0 (its only line is after the window end)');
select is((select today_cents from public.analytics_account_balances(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001']::uuid[], '2026-11-01'::date, '2026-11-01'::date)),
  7500::bigint, 'balances: with a later today the October line counts (8000 - 500)');

-- ---------------------------------------------------------------
-- analytics_goal_category_monthly
-- ---------------------------------------------------------------
select is((select count(*)::int from public.analytics_goal_category_monthly(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002']::uuid[])),
  3, 'goal categories: 3 rows (only the category linked to a live goal)');
select is((select total_abs_cents from public.analytics_goal_category_monthly(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002']::uuid[])
  where category_id = current_setting('t.cat_c')::uuid and month = '2026-09'),
  2000::bigint, 'goal categories: September = abs(-2000), deleted line ignored');
select is((select total_abs_cents from public.analytics_goal_category_monthly(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002']::uuid[])
  where category_id = current_setting('t.cat_c')::uuid and month = '2026-08'),
  1000::bigint, 'goal categories: full history, no anchor (August line counts)');
select is((select count(*)::int from public.analytics_goal_category_monthly(current_setting('t.space_a')::uuid,
  array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002']::uuid[])
  where category_id = current_setting('t.cat_d')::uuid),
  0, 'goal categories: a category linked only to a deleted goal is ignored');

-- ---------------------------------------------------------------
-- RLS: another user gets nothing
-- ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is(
  (select count(*)::int from public.analytics_account_monthly_deltas(current_setting('t.space_a')::uuid,
     array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002']::uuid[]))
  + (select count(*)::int from public.analytics_account_balances(current_setting('t.space_a')::uuid,
     array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002']::uuid[], '2026-10-01'::date, '2026-09-10'::date))
  + (select count(*)::int from public.analytics_goal_category_monthly(current_setting('t.space_a')::uuid,
     array['e1000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002']::uuid[])),
  0, 'RLS: a non-member gets 0 row from the three functions');

select * from finish();
rollback;
