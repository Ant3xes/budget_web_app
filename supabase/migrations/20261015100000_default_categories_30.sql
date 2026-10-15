-- issue 126: 13 new default expense categories (17 -> 30).
-- Part 1 replaces the seed function (starts from the issue 112 version, keeps
-- its partial-index ON CONFLICT clause). Part 2 backfills existing spaces.
-- Nothing is renamed or deleted; safe to replay.
create or replace function public.seed_default_categories(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (space_id, user_id, name, kind, color, icon, is_default, translation_key) values
    -- Expenses
    (p_space_id, p_user_id, 'Alimentation',   'expense',  '#22c55e', '🛒', true, 'alimentation'),
    (p_space_id, p_user_id, 'Logement',       'expense',  '#3b82f6', '🏠', true, 'logement'),
    (p_space_id, p_user_id, 'Transport',      'expense',  '#f59e0b', '🚗', true, 'transport'),
    (p_space_id, p_user_id, 'Santé',          'expense',  '#ef4444', '🏥', true, 'sante'),
    (p_space_id, p_user_id, 'Loisirs',        'expense',  '#8b5cf6', '🎮', true, 'loisirs'),
    (p_space_id, p_user_id, 'Vêtements',      'expense',  '#ec4899', '👗', true, 'vetements'),
    (p_space_id, p_user_id, 'Restaurants',    'expense',  '#f97316', '🍽️', true, 'restaurants'),
    (p_space_id, p_user_id, 'Voyages',        'expense',  '#06b6d4', '✈️', true, 'voyages'),
    (p_space_id, p_user_id, 'Abonnements',    'expense',  '#6366f1', '📱', true, 'abonnements'),
    (p_space_id, p_user_id, 'Education',      'expense',  '#84cc16', '📚', true, 'education'),
    (p_space_id, p_user_id, 'Cadeaux',        'expense',  '#f43f5e', '🎁', true, 'cadeaux'),
    (p_space_id, p_user_id, 'Banque & Frais', 'expense',  '#64748b', '🏦', true, 'banque_frais'),
    -- issue 126: 13 additional expense defaults
    (p_space_id, p_user_id, 'Supermarché', 'expense', '#16a34a', '🧺', true, 'supermarche'),
    (p_space_id, p_user_id, 'Commerces de proximité', 'expense', '#65a30d', '🥖', true, 'commerces_proximite'),
    (p_space_id, p_user_id, 'Transports en commun', 'expense', '#0ea5e9', '🚇', true, 'transports_en_commun'),
    (p_space_id, p_user_id, 'Taxi et VTC', 'expense', '#eab308', '🚕', true, 'taxi_vtc'),
    (p_space_id, p_user_id, 'Carburant', 'expense', '#dc2626', '⛽', true, 'carburant'),
    (p_space_id, p_user_id, 'Stationnement', 'expense', '#0284c7', '🅿️', true, 'stationnement'),
    (p_space_id, p_user_id, 'Vélo et trottinette', 'expense', '#14b8a6', '🚲', true, 'velo_trottinette'),
    (p_space_id, p_user_id, 'Sport', 'expense', '#ea580c', '🏋️', true, 'sport'),
    (p_space_id, p_user_id, 'Sorties et concerts', 'expense', '#a855f7', '🎤', true, 'sorties_concerts'),
    (p_space_id, p_user_id, 'Shopping', 'expense', '#d946ef', '🛍', true, 'shopping'),
    (p_space_id, p_user_id, 'Outils pro', 'expense', '#475569', '🧰', true, 'outils_pro'),
    (p_space_id, p_user_id, 'Impôts et amendes', 'expense', '#b91c1c', '🧾', true, 'impots_amendes'),
    (p_space_id, p_user_id, 'Dons', 'expense', '#fb7185', '🤝', true, 'dons'),
    -- Incomes
    (p_space_id, p_user_id, 'Salaire',        'income',   '#22c55e', '💰', true, 'salaire'),
    (p_space_id, p_user_id, 'Freelance',      'income',   '#3b82f6', '💻', true, 'freelance'),
    (p_space_id, p_user_id, 'Remboursement',  'income',   '#f59e0b', '🔄', true, 'remboursement'),
    (p_space_id, p_user_id, 'Autre revenu',   'income',   '#84cc16', '➕', true, 'autre_revenu'),
    -- Transfers
    (p_space_id, p_user_id, 'Virement interne', 'transfer', '#94a3b8', '🔁', true, 'virement_interne')
  on conflict (space_id, name, kind) where deleted_at is null do nothing;
end;
$$;

-- Backfill: add each missing default to every existing space, owned by the
-- space owner. Skips a space that already has an active category with the
-- same (name, kind), so no duplicate is created and a replay inserts nothing.
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
