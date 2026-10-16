-- issue 126: new-user defaults and replay of the migration's exact backfill.
begin;
select plan(9);
insert into auth.users (id, email) values
  ('fa300000-0000-4000-8000-000000000001', 'defaults-f@example.test');
select set_config('t.space', public.personal_space_id('fa300000-0000-4000-8000-000000000001')::text, true);
select is((select count(*)::int from public.categories where space_id = current_setting('t.space')::uuid), 30, 'new user receives 30 categories');
select is((select count(distinct translation_key)::int from public.categories where space_id = current_setting('t.space')::uuid), 30, 'all translation keys are present and unique');
select ok((select bool_and(is_default) from public.categories where space_id = current_setting('t.space')::uuid), 'all seeded categories are defaults');

-- Simulate a pre-backfill space: retain the original 17 and a custom Sport.
delete from public.categories where space_id = current_setting('t.space')::uuid
  and translation_key in ('supermarche', 'commerces_proximite', 'transports_en_commun', 'taxi_vtc', 'carburant', 'stationnement', 'velo_trottinette', 'sport', 'sorties_concerts', 'shopping', 'outils_pro', 'impots_amendes', 'dons');
insert into public.categories (id, space_id, user_id, name, kind, is_default)
values ('fa300000-0000-4000-8000-000000000002', current_setting('t.space')::uuid, 'fa300000-0000-4000-8000-000000000001', 'Sport', 'expense', false);
select is((select count(*)::int from public.categories where space_id = current_setting('t.space')::uuid), 18, 'legacy fixture has 17 defaults and one custom category');
insert into public.categories (space_id, user_id, name, kind, color, icon, is_default, translation_key)
select s.id, o.user_id, d.name, 'expense', d.color, d.icon, true, d.translation_key
from public.spaces s
cross join lateral (
  select sm.user_id
  from public.space_members sm
  where sm.space_id = s.id and sm.role = 'owner'
  order by sm.joined_at
  limit 1
) o
cross join (
  values
      ('Supermarché', '#16a34a', '🧺', 'supermarche'),
      ('Commerces de proximité', '#65a30d', '🥖', 'commerces_proximite'),
      ('Transports en commun', '#0ea5e9', '🚇', 'transports_en_commun'),
      ('Taxi et VTC', '#eab308', '🚕', 'taxi_vtc'),
      ('Carburant', '#dc2626', '⛽', 'carburant'),
      ('Stationnement', '#0284c7', '🅿️', 'stationnement'),
      ('Vélo et trottinette', '#14b8a6', '🚲', 'velo_trottinette'),
      ('Sport', '#ea580c', '🏋️', 'sport'),
      ('Sorties et concerts', '#a855f7', '🎤', 'sorties_concerts'),
      ('Shopping', '#d946ef', '🛍', 'shopping'),
      ('Outils pro', '#475569', '🧰', 'outils_pro'),
      ('Impôts et amendes', '#b91c1c', '🧾', 'impots_amendes'),
      ('Dons', '#fb7185', '🤝', 'dons')
) as d(name, color, icon, translation_key)
where not exists (
  select 1 from public.categories c
  where c.space_id = s.id
    and c.name = d.name
    and c.kind = 'expense'
    and c.deleted_at is null
);
select is((select count(*)::int from public.categories where space_id = current_setting('t.space')::uuid), 30, 'backfill adds the 12 missing defaults');
select is((select count(*)::int from public.categories where space_id = current_setting('t.space')::uuid and name = 'Sport' and kind = 'expense' and deleted_at is null), 1, 'same active name and kind is not duplicated');
select ok((select not is_default and translation_key is null from public.categories where id = 'fa300000-0000-4000-8000-000000000002'), 'existing custom category is not overwritten');
create temporary table before_replay as select * from public.categories;

-- Replay the exact backfill a second time.
insert into public.categories (space_id, user_id, name, kind, color, icon, is_default, translation_key)
select s.id, o.user_id, d.name, 'expense', d.color, d.icon, true, d.translation_key
from public.spaces s
cross join lateral (
  select sm.user_id
  from public.space_members sm
  where sm.space_id = s.id and sm.role = 'owner'
  order by sm.joined_at
  limit 1
) o
cross join (
  values
      ('Supermarché', '#16a34a', '🧺', 'supermarche'),
      ('Commerces de proximité', '#65a30d', '🥖', 'commerces_proximite'),
      ('Transports en commun', '#0ea5e9', '🚇', 'transports_en_commun'),
      ('Taxi et VTC', '#eab308', '🚕', 'taxi_vtc'),
      ('Carburant', '#dc2626', '⛽', 'carburant'),
      ('Stationnement', '#0284c7', '🅿️', 'stationnement'),
      ('Vélo et trottinette', '#14b8a6', '🚲', 'velo_trottinette'),
      ('Sport', '#ea580c', '🏋️', 'sport'),
      ('Sorties et concerts', '#a855f7', '🎤', 'sorties_concerts'),
      ('Shopping', '#d946ef', '🛍', 'shopping'),
      ('Outils pro', '#475569', '🧰', 'outils_pro'),
      ('Impôts et amendes', '#b91c1c', '🧾', 'impots_amendes'),
      ('Dons', '#fb7185', '🤝', 'dons')
) as d(name, color, icon, translation_key)
where not exists (
  select 1 from public.categories c
  where c.space_id = s.id
    and c.name = d.name
    and c.kind = 'expense'
    and c.deleted_at is null
);
select is((select count(*)::int from public.categories where space_id = current_setting('t.space')::uuid), 30, 'replaying backfill inserts nothing');
select results_eq('select * from public.categories order by id', 'select * from before_replay order by id', 'replay preserves every category in every space');
select * from finish();
rollback;
