-- Phase 2: seed default categories for new users
-- Adds seed_default_categories() and updates handle_new_user trigger

create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.categories (user_id, name, kind, color, icon) values
    -- Expenses
    (p_user_id, 'Alimentation',   'expense',  '#22c55e', '🛒'),
    (p_user_id, 'Logement',       'expense',  '#3b82f6', '🏠'),
    (p_user_id, 'Transport',      'expense',  '#f59e0b', '🚗'),
    (p_user_id, 'Santé',          'expense',  '#ef4444', '🏥'),
    (p_user_id, 'Loisirs',        'expense',  '#8b5cf6', '🎮'),
    (p_user_id, 'Vêtements',      'expense',  '#ec4899', '👗'),
    (p_user_id, 'Restaurants',    'expense',  '#f97316', '🍽️'),
    (p_user_id, 'Voyages',        'expense',  '#06b6d4', '✈️'),
    (p_user_id, 'Abonnements',    'expense',  '#6366f1', '📱'),
    (p_user_id, 'Education',      'expense',  '#84cc16', '📚'),
    (p_user_id, 'Cadeaux',        'expense',  '#f43f5e', '🎁'),
    (p_user_id, 'Banque & Frais', 'expense',  '#64748b', '🏦'),
    -- Incomes
    (p_user_id, 'Salaire',        'income',   '#22c55e', '💰'),
    (p_user_id, 'Freelance',      'income',   '#3b82f6', '💻'),
    (p_user_id, 'Remboursement',  'income',   '#f59e0b', '🔄'),
    (p_user_id, 'Autre revenu',   'income',   '#84cc16', '➕'),
    -- Transfers
    (p_user_id, 'Virement interne', 'transfer', '#94a3b8', '🔁')
  on conflict (user_id, name, kind) do nothing;
end;
$$;

-- Update handle_new_user to also seed categories
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)));
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;
