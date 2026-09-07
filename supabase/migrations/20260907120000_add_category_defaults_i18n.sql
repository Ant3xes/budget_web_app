-- Dashboard v2 / i18n: distinguish seeded default categories from
-- user-created ones so default category names can follow the app's locale
-- (FR/EN) while user-created categories are never auto-translated.
--
-- `is_default` flags rows inserted by seed_default_categories(); `translation_key`
-- is a stable slug (e.g. "alimentation") the client dictionary looks up when
-- is_default is true. Both are nullable-safe: existing rows get
-- is_default = false / translation_key = null, i.e. "always show name as-is",
-- the correct behavior for categories that predate this migration.
alter table public.categories
  add column if not exists is_default boolean not null default false,
  add column if not exists translation_key text;

-- Re-seed function: same 17 default categories, now tagged is_default = true
-- with a stable translation_key. Re-created (not altered in place) so the
-- migration stays a single readable snapshot of the current seed list.
create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, kind, color, icon, is_default, translation_key) values
    -- Expenses
    (p_user_id, 'Alimentation',   'expense',  '#22c55e', '🛒', true, 'alimentation'),
    (p_user_id, 'Logement',       'expense',  '#3b82f6', '🏠', true, 'logement'),
    (p_user_id, 'Transport',      'expense',  '#f59e0b', '🚗', true, 'transport'),
    (p_user_id, 'Santé',          'expense',  '#ef4444', '🏥', true, 'sante'),
    (p_user_id, 'Loisirs',        'expense',  '#8b5cf6', '🎮', true, 'loisirs'),
    (p_user_id, 'Vêtements',      'expense',  '#ec4899', '👗', true, 'vetements'),
    (p_user_id, 'Restaurants',    'expense',  '#f97316', '🍽️', true, 'restaurants'),
    (p_user_id, 'Voyages',        'expense',  '#06b6d4', '✈️', true, 'voyages'),
    (p_user_id, 'Abonnements',    'expense',  '#6366f1', '📱', true, 'abonnements'),
    (p_user_id, 'Education',      'expense',  '#84cc16', '📚', true, 'education'),
    (p_user_id, 'Cadeaux',        'expense',  '#f43f5e', '🎁', true, 'cadeaux'),
    (p_user_id, 'Banque & Frais', 'expense',  '#64748b', '🏦', true, 'banque_frais'),
    -- Incomes
    (p_user_id, 'Salaire',        'income',   '#22c55e', '💰', true, 'salaire'),
    (p_user_id, 'Freelance',      'income',   '#3b82f6', '💻', true, 'freelance'),
    (p_user_id, 'Remboursement',  'income',   '#f59e0b', '🔄', true, 'remboursement'),
    (p_user_id, 'Autre revenu',   'income',   '#84cc16', '➕', true, 'autre_revenu'),
    -- Transfers
    (p_user_id, 'Virement interne', 'transfer', '#94a3b8', '🔁', true, 'virement_interne')
  on conflict (user_id, name, kind) do nothing;
end;
$$;

comment on column public.categories.is_default is
  'True for rows inserted by seed_default_categories() at account creation. Drives whether the UI resolves the display name via translation_key (FR/EN) or shows the stored name as-is (always the case for user-created categories).';
comment on column public.categories.translation_key is
  'Stable slug (e.g. "alimentation") used to look up this default category''s name in the app''s i18n dictionary. Null for user-created categories and for default categories seeded before this migration.';
