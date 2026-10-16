-- issue 112: only active categories reserve their (space, name, kind).
begin;
select plan(6);
insert into auth.users (id, email) values
  ('fa120000-0000-4000-8000-000000000001', 'unique-f@example.test');
select set_config('t.space', public.personal_space_id('fa120000-0000-4000-8000-000000000001')::text, true);
insert into public.categories (id, space_id, user_id, name, kind) values
  ('fa120000-0000-4000-8000-000000000002', current_setting('t.space')::uuid, 'fa120000-0000-4000-8000-000000000001', 'Catégorie synthétique F', 'expense'),
  ('fa120000-0000-4000-8000-000000000003', current_setting('t.space')::uuid, 'fa120000-0000-4000-8000-000000000001', 'Autre catégorie F', 'expense');
select throws_ok($$insert into public.categories (space_id, user_id, name, kind)
  values (current_setting('t.space')::uuid, 'fa120000-0000-4000-8000-000000000001', 'Catégorie synthétique F', 'expense')$$,
  '23505', null, 'duplicate active name in the same space and kind is rejected');
select lives_ok($$insert into public.categories (space_id, user_id, name, kind)
  values (current_setting('t.space')::uuid, 'fa120000-0000-4000-8000-000000000001', 'Catégorie synthétique F', 'income')$$,
  'same name with a different kind is allowed');
update public.categories set deleted_at = now() where id = 'fa120000-0000-4000-8000-000000000002';
select lives_ok($$update public.categories set name = 'Catégorie synthétique F'
  where id = 'fa120000-0000-4000-8000-000000000003'$$,
  'rename to a deleted category name succeeds');
update public.categories set name = 'Autre catégorie F' where id = 'fa120000-0000-4000-8000-000000000003';
select lives_ok($$insert into public.categories (space_id, user_id, name, kind)
  values (current_setting('t.space')::uuid, 'fa120000-0000-4000-8000-000000000001', 'Catégorie synthétique F', 'expense')$$,
  'recreating a soft-deleted category name succeeds');
select is((select count(*)::int from public.categories where space_id = current_setting('t.space')::uuid
  and name = 'Catégorie synthétique F' and kind = 'expense' and deleted_at is null), 1, 'exactly one active expense owns the name');
select ok((select deleted_at is not null from public.categories where id = 'fa120000-0000-4000-8000-000000000002'),
  'the original deleted category remains preserved');
select * from finish();
rollback;
