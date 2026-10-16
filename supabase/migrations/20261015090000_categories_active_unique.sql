-- issue 112: deleted categories no longer reserve their name.
-- Existing rows and their references stay untouched.
alter table public.categories
  drop constraint categories_space_id_name_kind_key;

create unique index categories_space_id_name_kind_active_key
  on public.categories (space_id, name, kind)
  where deleted_at is null;

-- issue 112: ON CONFLICT must infer the partial index when seeding future
-- personal/shared spaces. This function definition does not change any rows.
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
