-- Amorçage MANUEL uniquement : jamais inclus dans config.toml / seed.sql.
-- Créer d'abord l'utilisateur dans Supabase Auth, puis remplacer l'adresse
-- demo@example.invalid ci-dessous par son email. Exécuter comme postgres dans
-- le SQL editor Supabase (ou psql -v ON_ERROR_STOP=1 -f ce-fichier.sql).
-- Aucun mot de passe, aucune donnée réelle. Les catégories de l'inscription
-- sont réutilisées. Identifiants et dates fixes rendent la relance idempotente.
-- Réservé à un compte neuf : le script ne supprime/modifie aucune donnée existante.
begin;
do $$
declare
  v_user uuid;
  v_space uuid;
  v_account uuid;
  v_category uuid;
  v_row record;
begin
  select id into strict v_user from auth.users where email = 'demo@example.invalid';
  v_space := public.personal_space_id(v_user);
  if v_space is null then
    raise exception 'personal space missing for demo user';
  end if;

  insert into public.demo_users (user_id) values (v_user) on conflict do nothing;

  insert into public.accounts (id, space_id, user_id, name, type, initial_balance_cents)
  select md5(v_user::text || ':demo:account:' || n)::uuid, v_space, v_user, name, type, balance
  from (values
    (1, 'Compte courant démo', 'courant', 150000),
    (2, 'Livret démo', 'livret', 480000),
    (3, 'Épargne démo', 'épargne', 250000)
  ) as a(n, name, type, balance)
  on conflict (id) do nothing;
  v_account := md5(v_user::text || ':demo:account:1')::uuid;

  -- Douze mois fixes, 12 opérations par mois : 144 lignes fictives.
  insert into public.transactions (
    id, space_id, user_id, account_id, category_id, kind, amount_cents, date, description
  )
  select md5(v_user::text || ':demo:transaction:' || m || ':' || n)::uuid,
    v_space, v_user, v_account, c.id, c.kind,
    case when c.kind = 'income' then 285000 + m * 100
         when n = 2 then -82000 else -(1800 + n * 430 + m * 37) end,
    (date '2025-11-01' + make_interval(months => m, days => n * 2)) at time zone 'UTC', label
  from generate_series(0, 11) as months(m)
  cross join (values
    (1, 'Salaire', 'salaire'), (2, 'Loyer', 'logement'),
    (3, 'Supermarche', 'alimentation'), (4, 'Transport', 'transport'),
    (5, 'Restaurant', 'restaurants'), (6, 'Cinema', 'loisirs'),
    (7, 'Supermarche', 'alimentation'), (8, 'Abonnement', 'abonnements'),
    (9, 'Pharmacie', 'sante'), (10, 'Restaurant', 'restaurants'),
    (11, 'Supermarche', 'alimentation'), (12, 'Loisirs', 'loisirs')
  ) as operations(n, label, category_key)
  join public.categories c on c.space_id = v_space
    and c.translation_key = category_key and c.deleted_at is null
  on conflict (id) do nothing;

  for v_row in select * from (values
    ('alimentation', 40000), ('logement', 85000),
    ('transport', 15000), ('loisirs', 18000)
  ) as b(category_key, amount) loop
    select id into strict v_category from public.categories
      where space_id = v_space and translation_key = v_row.category_key and deleted_at is null;
    insert into public.budgets (space_id, user_id, category_id, month, amount_cents)
    values (v_space, v_user, v_category, date '2026-10-01', v_row.amount)
    on conflict (space_id, category_id, month) do nothing;
  end loop;

  insert into public.savings_goals (id, space_id, user_id, name, target_amount_cents, current_amount_cents, deadline)
  select md5(v_user::text || ':demo:goal:' || n)::uuid, v_space, v_user, name, target, amount, date '2027-06-01'
  from (values (1, 'Voyage fictif', 200000, 85000), (2, 'Fonds de secours fictif', 600000, 320000)) as g(n, name, target, amount)
  on conflict (id) do nothing;

  insert into public.fixed_charges (id, space_id, user_id, name, amount_cents, frequency, next_due_date, account_id, category_id)
  select md5(v_user::text || ':demo:charge:' || n)::uuid, v_space, v_user,
    f.name, f.amount, 'monthly', date '2026-11-01', v_account, c.id
  from (values (1, 'Loyer fictif', 82000, 'logement'),
    (2, 'Internet fictif', 3000, 'abonnements'),
    (3, 'Transport fictif', 4500, 'transport')) as f(n, name, amount, category_key)
  join public.categories c on c.space_id = v_space and c.translation_key = category_key and c.deleted_at is null
  on conflict (id) do nothing;
end;
$$;
commit;
