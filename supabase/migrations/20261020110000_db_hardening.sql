-- Durcissement additif : aucune ligne existante modifiée ni supprimée (ADR 0008).
-- transactions_space_account_date_idx couvre déjà le filtre actif et le tri
-- décroissant par parcours btree inverse quand space_id/account_id sont fixés.
-- Les index partiels FK "IS NOT NULL" existants couvrent toutes les références.


create index if not exists invitations_space_id_idx on public.invitations (space_id);

create index if not exists csv_import_rules_category_id_idx on public.csv_import_rules (category_id);

create index if not exists invitations_inviter_user_id_idx on public.invitations (inviter_user_id);

create index if not exists invitations_accepted_by_user_id_idx on public.invitations (accepted_by_user_id);

create index if not exists accounts_user_id_idx on public.accounts (user_id);

create index if not exists categories_user_id_idx on public.categories (user_id);

create index if not exists transactions_user_id_idx on public.transactions (user_id);

create index if not exists transactions_account_id_idx on public.transactions (account_id);

create index if not exists transactions_category_id_idx on public.transactions (category_id);

create index if not exists budgets_user_id_idx on public.budgets (user_id);

create index if not exists budgets_category_id_idx on public.budgets (category_id);

create index if not exists savings_goals_user_id_idx on public.savings_goals (user_id);

create index if not exists csv_import_rules_user_id_idx on public.csv_import_rules (user_id);

create index if not exists fixed_charges_user_id_idx on public.fixed_charges (user_id);

create index if not exists fixed_charges_account_id_idx on public.fixed_charges (account_id);

create index if not exists fixed_charges_category_id_idx on public.fixed_charges (category_id);

create index if not exists savings_goals_linked_category_id_idx on public.savings_goals (linked_category_id);

create index if not exists spaces_created_by_idx on public.spaces (created_by);

create index if not exists shared_expenses_paid_by_idx on public.shared_expenses (paid_by);

create index if not exists shared_expenses_category_id_idx on public.shared_expenses (category_id);

create index if not exists settlements_from_user_idx on public.settlements (from_user);

create index if not exists settlements_to_user_idx on public.settlements (to_user);

create index if not exists settlements_created_by_idx on public.settlements (created_by);

create index if not exists csv_import_rules_share_space_id_idx on public.csv_import_rules (share_space_id);

create index if not exists csv_import_rules_share_category_id_idx on public.csv_import_rules (share_category_id);


-- Expressions pg_policies recopiées ; seuls les appels sont enveloppés.
-- Les sous-requêtes dépendant de la ligne restent corrélées (pas un InitPlan).
-- invitations_insert conserve sa jointure EXISTS telle quelle.

alter policy profiles_update_own on public.profiles
  using (((select auth.uid()) = id))
  with check (((select auth.uid()) = id));

alter policy accounts_select_member on public.accounts
  using ((select public.is_space_member(space_id)));

alter policy accounts_insert_member on public.accounts
  with check (((select public.is_space_member(space_id)) AND (user_id = (select auth.uid()))));

alter policy accounts_update_member on public.accounts
  using ((select public.is_space_member(space_id)))
  with check ((select public.is_space_member(space_id)));

alter policy accounts_delete_member on public.accounts
  using ((select public.is_space_member(space_id)));

alter policy categories_select_member on public.categories
  using ((select public.is_space_member(space_id)));

alter policy categories_insert_member on public.categories
  with check (((select public.is_space_member(space_id)) AND (user_id = (select auth.uid()))));

alter policy fixed_charges_delete_member on public.fixed_charges
  using ((select public.is_space_member(space_id)));

alter policy categories_update_member on public.categories
  using ((select public.is_space_member(space_id)))
  with check ((select public.is_space_member(space_id)));

alter policy categories_delete_member on public.categories
  using ((select public.is_space_member(space_id)));

alter policy transactions_select_member on public.transactions
  using ((select public.is_space_member(space_id)));

alter policy transactions_insert_member on public.transactions
  with check (((select public.is_space_member(space_id)) AND (user_id = (select auth.uid()))));

alter policy transactions_update_member on public.transactions
  using ((select public.is_space_member(space_id)))
  with check ((select public.is_space_member(space_id)));

alter policy transactions_delete_member on public.transactions
  using ((select public.is_space_member(space_id)));

alter policy budgets_select_member on public.budgets
  using ((select public.is_space_member(space_id)));

alter policy budgets_insert_member on public.budgets
  with check (((select public.is_space_member(space_id)) AND (user_id = (select auth.uid()))));

alter policy budgets_update_member on public.budgets
  using ((select public.is_space_member(space_id)))
  with check ((select public.is_space_member(space_id)));

alter policy budgets_delete_member on public.budgets
  using ((select public.is_space_member(space_id)));

alter policy fixed_charges_select_member on public.fixed_charges
  using ((select public.is_space_member(space_id)));

alter policy fixed_charges_insert_member on public.fixed_charges
  with check (((select public.is_space_member(space_id)) AND (user_id = (select auth.uid()))));

alter policy fixed_charges_update_member on public.fixed_charges
  using ((select public.is_space_member(space_id)))
  with check ((select public.is_space_member(space_id)));

alter policy savings_goals_select_member on public.savings_goals
  using ((select public.is_space_member(space_id)));

alter policy savings_goals_insert_member on public.savings_goals
  with check (((select public.is_space_member(space_id)) AND (user_id = (select auth.uid()))));

alter policy savings_goals_update_member on public.savings_goals
  using ((select public.is_space_member(space_id)))
  with check ((select public.is_space_member(space_id)));

alter policy savings_goals_delete_member on public.savings_goals
  using ((select public.is_space_member(space_id)));

alter policy csv_import_rules_select_member on public.csv_import_rules
  using ((select public.is_space_member(space_id)));

alter policy csv_import_rules_insert_member on public.csv_import_rules
  with check (((select public.is_space_member(space_id)) AND (user_id = (select auth.uid()))));

alter policy csv_import_rules_update_member on public.csv_import_rules
  using ((select public.is_space_member(space_id)))
  with check ((select public.is_space_member(space_id)));

alter policy csv_import_rules_delete_member on public.csv_import_rules
  using ((select public.is_space_member(space_id)));

alter policy spaces_select_member on public.spaces
  using ((select public.is_space_member(id)));

alter policy spaces_update_owner on public.spaces
  using ((select public.is_space_owner(id)))
  with check ((select public.is_space_owner(id)));

alter policy spaces_delete_owner on public.spaces
  using (((select public.is_space_owner(id)) AND (kind = 'shared'::text)));

alter policy space_members_select_member on public.space_members
  using ((select public.is_space_member(space_id)));

alter policy space_members_delete on public.space_members
  using ((((user_id = (select auth.uid())) AND (role <> 'owner'::text)) OR ((select public.is_space_owner(space_id)) AND (user_id <> (select auth.uid())))));

alter policy profiles_select_self_or_comember on public.profiles
  using ((((select auth.uid()) = id) OR (select public.shares_space_with(id))));

alter policy invitations_select on public.invitations
  using ((((select auth.uid()) = inviter_user_id) OR ((select auth.uid()) = accepted_by_user_id) OR ((space_id IS NOT NULL) AND (select public.is_space_member(space_id)))));

alter policy invitations_revoke on public.invitations
  using (((status = 'pending'::text) AND (((select auth.uid()) = inviter_user_id) OR ((space_id IS NOT NULL) AND (select public.is_space_owner(space_id))))))
  with check (((status = 'revoked'::text) AND (((select auth.uid()) = inviter_user_id) OR ((space_id IS NOT NULL) AND (select public.is_space_owner(space_id))))));

alter policy shared_expenses_select_member on public.shared_expenses
  using ((select public.is_space_member(space_id)));

alter policy shared_expenses_insert_payer on public.shared_expenses
  with check (((select public.is_space_member(space_id)) AND (paid_by = (select auth.uid()))));

alter policy shared_expenses_update_payer on public.shared_expenses
  using (((select public.is_space_member(space_id)) AND (paid_by = (select auth.uid()))))
  with check (((select public.is_space_member(space_id)) AND (paid_by = (select auth.uid()))));

alter policy shared_expenses_delete_payer on public.shared_expenses
  using (((select public.is_space_member(space_id)) AND (paid_by = (select auth.uid()))));

alter policy settlements_select_member on public.settlements
  using ((select public.is_space_member(space_id)));

alter policy settlements_insert_party on public.settlements
  with check (((select public.is_space_member(space_id)) AND (created_by = (select auth.uid())) AND ((from_user = (select auth.uid())) OR (to_user = (select auth.uid())))));

alter policy settlements_delete_creator on public.settlements
  using (((select public.is_space_member(space_id)) AND (created_by = (select auth.uid()))));


-- RPC de prévisualisation publique conservée : get_space_invitation(text).

revoke select, insert, update, delete on table
  public.accounts,
  public.budgets,
  public.categories,
  public.csv_import_rules,
  public.fixed_charges,
  public.invitations,
  public.profiles,
  public.savings_goals,
  public.settlements,
  public.shared_expenses,
  public.space_members,
  public.spaces,
  public.transactions
from anon;

-- Les droits par défaut globaux Supabase et ceux du schéma sont additifs.
-- Retirer les deux niveaux pour le rôle créateur des migrations.
alter default privileges for role postgres
  revoke select, insert, update, delete on tables from anon;
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon;

-- Supabase initialise aussi des ACL pour ce rôle administrateur. Ne pas faire
-- échouer une migration hébergée si postgres n'en est pas membre : l'ADR donne
-- le contrôle et la commande à exécuter par l'administrateur dans ce cas.
do $$
begin
  if pg_has_role(current_user, 'supabase_admin', 'MEMBER') then
    alter default privileges for role supabase_admin in schema public
      revoke select, insert, update, delete on tables from anon;
  else
    raise notice 'supabase_admin default privileges require administrator review (ADR 0008)';
  end if;
end;
$$;

create or replace function public.prevent_user_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'user_id cannot be changed' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function public.prevent_user_change() from public, anon, authenticated;


create or replace trigger accounts_prevent_user_change
  before update on public.accounts
  for each row execute function public.prevent_user_change();

create or replace trigger categories_prevent_user_change
  before update on public.categories
  for each row execute function public.prevent_user_change();

create or replace trigger transactions_prevent_user_change
  before update on public.transactions
  for each row execute function public.prevent_user_change();

create or replace trigger budgets_prevent_user_change
  before update on public.budgets
  for each row execute function public.prevent_user_change();

create or replace trigger fixed_charges_prevent_user_change
  before update on public.fixed_charges
  for each row execute function public.prevent_user_change();

create or replace trigger savings_goals_prevent_user_change
  before update on public.savings_goals
  for each row execute function public.prevent_user_change();

create or replace trigger csv_import_rules_prevent_user_change
  before update on public.csv_import_rules
  for each row execute function public.prevent_user_change();


-- NOT VALID : aucune hypothèse sur les données de production existantes.
-- Les nouvelles écritures et mises à jour sont contrôlées immédiatement.
do $$
begin

  if not exists (select 1 from pg_constraint where conrelid = 'public.accounts'::regclass and conname = 'accounts_currency_format') then
    alter table public.accounts add constraint accounts_currency_format
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.accounts'::regclass and conname = 'accounts_name_length') then
    alter table public.accounts add constraint accounts_name_length
      check (char_length(name) <= 200) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.budgets'::regclass and conname = 'budgets_currency_format') then
    alter table public.budgets add constraint budgets_currency_format
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.categories'::regclass and conname = 'categories_name_length') then
    alter table public.categories add constraint categories_name_length
      check (char_length(name) <= 200) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.fixed_charges'::regclass and conname = 'fixed_charges_currency_format') then
    alter table public.fixed_charges add constraint fixed_charges_currency_format
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.fixed_charges'::regclass and conname = 'fixed_charges_name_length') then
    alter table public.fixed_charges add constraint fixed_charges_name_length
      check (char_length(name) <= 200) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.fixed_charges'::regclass and conname = 'fixed_charges_notes_length') then
    alter table public.fixed_charges add constraint fixed_charges_notes_length
      check (char_length(notes) <= 10000) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_default_currency_format') then
    alter table public.profiles add constraint profiles_default_currency_format
      check (default_currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.profiles'::regclass and conname = 'profiles_full_name_length') then
    alter table public.profiles add constraint profiles_full_name_length
      check (char_length(full_name) <= 200) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.savings_goals'::regclass and conname = 'savings_goals_currency_format') then
    alter table public.savings_goals add constraint savings_goals_currency_format
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.savings_goals'::regclass and conname = 'savings_goals_name_length') then
    alter table public.savings_goals add constraint savings_goals_name_length
      check (char_length(name) <= 200) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.shared_expenses'::regclass and conname = 'shared_expenses_currency_format') then
    alter table public.shared_expenses add constraint shared_expenses_currency_format
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.shared_expenses'::regclass and conname = 'shared_expenses_description_length') then
    alter table public.shared_expenses add constraint shared_expenses_description_length
      check (char_length(description) <= 10000) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.spaces'::regclass and conname = 'spaces_name_length') then
    alter table public.spaces add constraint spaces_name_length
      check (char_length(name) <= 200) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.transactions'::regclass and conname = 'transactions_currency_format') then
    alter table public.transactions add constraint transactions_currency_format
      check (currency ~ '^[A-Z]{3}$') not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.transactions'::regclass and conname = 'transactions_description_length') then
    alter table public.transactions add constraint transactions_description_length
      check (char_length(description) <= 10000) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.transactions'::regclass and conname = 'transactions_notes_length') then
    alter table public.transactions add constraint transactions_notes_length
      check (char_length(notes) <= 10000) not valid;
  end if;

end;
$$;
