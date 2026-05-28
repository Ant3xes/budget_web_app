-- ============================================================
-- SEED — Données de test
-- Utilisateur test : test@budget.local / Password1234!
-- UUID fixe : a0000000-0000-0000-0000-000000000001
-- ============================================================

-- 1. Utilisateur Auth (bypass RLS — s'exécute en tant que postgres)
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'test@budget.local',
  crypt('Password1234!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Alice Dupont"}',
  false, '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider,
  identity_data, last_sign_in_at, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  'test@budget.local', 'email',
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"test@budget.local"}',
  now(), now(), now()
) on conflict (provider, provider_id) do nothing;

-- 2. Profil (le trigger handle_new_user crée aussi les catégories par défaut)
insert into public.profiles (id, full_name, default_currency)
values ('a0000000-0000-0000-0000-000000000001', 'Alice Dupont', 'EUR')
on conflict (id) do nothing;

-- Seed des catégories par défaut si le trigger ne s'est pas déclenché
select public.seed_default_categories('a0000000-0000-0000-0000-000000000001');

-- ============================================================
-- Raccourcis locaux pour les UUIDs de catégories
-- ============================================================
do $$
declare
  uid          uuid := 'a0000000-0000-0000-0000-000000000001';

  -- Comptes
  acc_courant  uuid := 'b0000000-0000-0000-0000-000000000001';
  acc_epargne  uuid := 'b0000000-0000-0000-0000-000000000002';
  acc_livret   uuid := 'b0000000-0000-0000-0000-000000000003';

  -- Catégories (récupérées dynamiquement)
  cat_alim     uuid;
  cat_loge     uuid;
  cat_trans    uuid;
  cat_sante    uuid;
  cat_loisir   uuid;
  cat_resto    uuid;
  cat_abo      uuid;
  cat_salaire  uuid;
  cat_freelan  uuid;
  cat_remb     uuid;
  cat_virt     uuid;

  -- Transactions
  transfer_id  uuid := gen_random_uuid();

begin

  -- Récupération des IDs de catégories
  select id into cat_alim    from public.categories where user_id = uid and name = 'Alimentation'    and kind = 'expense';
  select id into cat_loge    from public.categories where user_id = uid and name = 'Logement'        and kind = 'expense';
  select id into cat_trans   from public.categories where user_id = uid and name = 'Transport'       and kind = 'expense';
  select id into cat_sante   from public.categories where user_id = uid and name = 'Santé'           and kind = 'expense';
  select id into cat_loisir  from public.categories where user_id = uid and name = 'Loisirs'         and kind = 'expense';
  select id into cat_resto   from public.categories where user_id = uid and name = 'Restaurants'     and kind = 'expense';
  select id into cat_abo     from public.categories where user_id = uid and name = 'Abonnements'     and kind = 'expense';
  select id into cat_salaire from public.categories where user_id = uid and name = 'Salaire'         and kind = 'income';
  select id into cat_freelan from public.categories where user_id = uid and name = 'Freelance'       and kind = 'income';
  select id into cat_remb    from public.categories where user_id = uid and name = 'Remboursement'   and kind = 'income';
  select id into cat_virt    from public.categories where user_id = uid and name = 'Virement interne' and kind = 'transfer';

  -- ============================================================
  -- 3. Comptes
  -- ============================================================
  insert into public.accounts (id, user_id, name, type, initial_balance_cents, currency) values
    (acc_courant, uid, 'BNP Compte courant',  'courant', 150000,  'EUR'),
    (acc_epargne, uid, 'Livret A',             'livret',  500000,  'EUR'),
    (acc_livret,  uid, 'PEL CIC',              'PEL',     1200000, 'EUR')
  on conflict (id) do nothing;

  -- ============================================================
  -- 4. Transactions — mai 2026
  -- ============================================================
  insert into public.transactions
    (user_id, account_id, category_id, kind, amount_cents, date, description)
  values
    -- Revenus
    (uid, acc_courant, cat_salaire, 'income',  285000, '2026-05-05 00:00:00+00', 'Salaire mai 2026'),
    (uid, acc_courant, cat_freelan, 'income',   75000, '2026-05-12 00:00:00+00', 'Mission UX — client Acme'),
    (uid, acc_courant, cat_remb,    'income',    3200, '2026-05-18 00:00:00+00', 'Remboursement mutuelle'),

    -- Dépenses
    (uid, acc_courant, cat_loge,   'expense', 85000,  '2026-05-01 00:00:00+00', 'Loyer mai'),
    (uid, acc_courant, cat_alim,   'expense',  9850,  '2026-05-03 00:00:00+00', 'Courses Carrefour'),
    (uid, acc_courant, cat_trans,  'expense',  8400,  '2026-05-04 00:00:00+00', 'Navigo mensuel'),
    (uid, acc_courant, cat_resto,  'expense',  3200,  '2026-05-07 00:00:00+00', 'Déjeuner équipe'),
    (uid, acc_courant, cat_abo,    'expense',  1799,  '2026-05-10 00:00:00+00', 'Netflix'),
    (uid, acc_courant, cat_sante,  'expense',  4500,  '2026-05-14 00:00:00+00', 'Dentiste'),
    (uid, acc_courant, cat_loisir, 'expense',  2999,  '2026-05-16 00:00:00+00', 'Spotify Premium'),
    (uid, acc_courant, cat_alim,   'expense', 12350,  '2026-05-17 00:00:00+00', 'Courses Monoprix'),
    (uid, acc_courant, cat_resto,  'expense',  5600,  '2026-05-20 00:00:00+00', 'Restaurant L''Étoile'),
    (uid, acc_courant, cat_abo,    'expense',   999,  '2026-05-22 00:00:00+00', 'iCloud 50 Go'),
    (uid, acc_courant, cat_trans,  'expense',  6500,  '2026-05-24 00:00:00+00', 'Essence Total'),
    (uid, acc_courant, cat_loisir, 'expense',  1800,  '2026-05-26 00:00:00+00', 'Cinéma × 2'),

    -- Transactions avril 2026 (historique)
    (uid, acc_courant, cat_salaire, 'income',  285000, '2026-04-05 00:00:00+00', 'Salaire avril 2026'),
    (uid, acc_courant, cat_loge,   'expense',  85000,  '2026-04-01 00:00:00+00', 'Loyer avril'),
    (uid, acc_courant, cat_alim,   'expense',  11200,  '2026-04-08 00:00:00+00', 'Courses Grand Frais'),
    (uid, acc_courant, cat_resto,  'expense',   4200,  '2026-04-15 00:00:00+00', 'Brunch du dimanche'),
    (uid, acc_courant, cat_trans,  'expense',   8400,  '2026-04-04 00:00:00+00', 'Navigo mensuel'),
    (uid, acc_courant, cat_abo,    'expense',   1799,  '2026-04-10 00:00:00+00', 'Netflix'),

    -- Transactions sur livret A
    (uid, acc_epargne, cat_remb,   'income',   10000,  '2026-05-01 00:00:00+00', 'Intérêts livret A');

  -- Virement interne (courant → livret A)
  insert into public.transactions
    (user_id, account_id, category_id, transfer_id, kind, amount_cents, date, description)
  values
    (uid, acc_courant, cat_virt, transfer_id, 'transfer_debit',  20000, '2026-05-25 00:00:00+00', 'Virement vers Livret A'),
    (uid, acc_epargne, cat_virt, transfer_id, 'transfer_credit', 20000, '2026-05-25 00:00:00+00', 'Virement depuis BNP');

  -- ============================================================
  -- 5. Budgets — mai 2026
  -- ============================================================
  insert into public.budgets (user_id, category_id, month, amount_cents) values
    (uid, cat_alim,   '2026-05-01', 30000),
    (uid, cat_loge,   '2026-05-01', 90000),
    (uid, cat_trans,  '2026-05-01', 15000),
    (uid, cat_sante,  '2026-05-01', 10000),
    (uid, cat_loisir, '2026-05-01', 8000),
    (uid, cat_resto,  '2026-05-01', 12000),
    (uid, cat_abo,    '2026-05-01', 5000)
  on conflict (user_id, category_id, month) do nothing;

  -- ============================================================
  -- 6. Charges fixes
  -- ============================================================
  insert into public.fixed_charges
    (user_id, name, amount_cents, frequency, next_due_date, account_id, category_id, notes, status)
  values
    (uid, 'Loyer',              85000, 'monthly',   '2026-06-01', acc_courant, cat_loge,   'Virement proprio',        'active'),
    (uid, 'Navigo mensuel',      8400, 'monthly',   '2026-06-04', acc_courant, cat_trans,  'Rechargement station',    'active'),
    (uid, 'Netflix',             1799, 'monthly',   '2026-06-10', acc_courant, cat_abo,    null,                      'active'),
    (uid, 'Spotify',             2999, 'monthly',   '2026-06-16', acc_courant, cat_loisir, null,                      'active'),
    (uid, 'iCloud 50 Go',         999, 'monthly',   '2026-06-22', acc_courant, cat_abo,    null,                      'active'),
    (uid, 'Assurance habitation',7200, 'yearly',    '2027-01-15', acc_courant, null,        'Prélevement annuel AXA',  'active'),
    (uid, 'Taxe foncière',      45000, 'yearly',    '2026-10-15', acc_courant, null,        null,                      'active')
  on conflict do nothing;

  -- ============================================================
  -- 7. Objectifs d'épargne
  -- ============================================================
  insert into public.savings_goals
    (user_id, name, target_amount_cents, current_amount_cents, currency, deadline)
  values
    (uid, 'Voyage au Japon',   400000,  85000, 'EUR', '2026-12-31'),
    (uid, 'Fonds d''urgence',  300000, 180000, 'EUR', null),
    (uid, 'Nouvelle voiture', 1500000, 320000, 'EUR', '2028-06-01')
  on conflict do nothing;

  -- ============================================================
  -- 8. Règles d'import CSV
  -- ============================================================
  insert into public.csv_import_rules (user_id, keyword, category_id, kind) values
    (uid, 'CARREFOUR',   cat_alim,   'expense'),
    (uid, 'MONOPRIX',    cat_alim,   'expense'),
    (uid, 'FRANPRIX',    cat_alim,   'expense'),
    (uid, 'SNCF',        cat_trans,  'expense'),
    (uid, 'TOTAL',       cat_trans,  'expense'),
    (uid, 'RATP',        cat_trans,  'expense'),
    (uid, 'NETFLIX',     cat_abo,    'expense'),
    (uid, 'SPOTIFY',     cat_abo,    'expense'),
    (uid, 'APPLE',       cat_abo,    'expense'),
    (uid, 'UBER EATS',   cat_resto,  'expense'),
    (uid, 'DELIVEROO',   cat_resto,  'expense'),
    (uid, 'VIR SALAIRE', cat_salaire,'income')
  on conflict do nothing;

  -- ============================================================
  -- 9. Invitation
  -- ============================================================
  insert into public.invitations
    (inviter_user_id, invitee_email, token, status)
  values
    (uid, 'bob@example.com', 'test-invite-token-bob', 'pending')
  on conflict do nothing;

end $$;
