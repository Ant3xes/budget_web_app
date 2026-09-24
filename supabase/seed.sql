-- ============================================================
-- SEED — Données de test
-- Utilisateur test : test@budget.local / Password1234!
-- UUID fixe : a0000000-0000-0000-0000-000000000001
--
-- Historique transactions : janv. 2024 → sept. 2026 (~32 mois)
-- pour vérifier les filtres du graphique « Évolution du solde ».
-- Juin → sept. 2026 : jeu de données exhaustif sur les 3 comptes
-- (courant / Livret A / PEL), avec virements croisés dans les deux sens,
-- dépenses et revenus sur chaque compte, pour exercer tous les graphiques.
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
select public.seed_default_categories(
  public.personal_space_id('a0000000-0000-0000-0000-000000000001'),
  'a0000000-0000-0000-0000-000000000001'
);

-- ============================================================
-- Raccourcis locaux pour les UUIDs de catégories
-- ============================================================
do $$
declare
  uid          uuid := 'a0000000-0000-0000-0000-000000000001';
  spc          uuid := public.personal_space_id('a0000000-0000-0000-0000-000000000001');

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
  cat_vetement uuid;
  cat_voyage   uuid;
  cat_educ     uuid;
  cat_cadeau   uuid;
  cat_banque   uuid;
  cat_autrerev uuid;

  -- Transactions
  transfer_id  uuid := gen_random_uuid();

  -- Virements multi-comptes (juin → sept. 2026)
  tr_jun_ce    uuid := gen_random_uuid(); -- courant -> épargne
  tr_jul_ec    uuid := gen_random_uuid(); -- épargne -> courant (retrait vacances)
  tr_jul_ce    uuid := gen_random_uuid(); -- courant -> épargne
  tr_aug_cp    uuid := gen_random_uuid(); -- courant -> PEL
  tr_aug_ep    uuid := gen_random_uuid(); -- épargne -> PEL
  tr_aug_ce    uuid := gen_random_uuid(); -- courant -> épargne
  tr_sep_ce    uuid := gen_random_uuid(); -- courant -> épargne

  -- Boucle historique long (> 2 ans) pour le graphique
  hist_month   date;
  hist_i       int;
  month_lbl    text;

begin

  -- Récupération des IDs de catégories
  select id into cat_alim    from public.categories where space_id = spc and name = 'Alimentation'    and kind = 'expense';
  select id into cat_loge    from public.categories where space_id = spc and name = 'Logement'        and kind = 'expense';
  select id into cat_trans   from public.categories where space_id = spc and name = 'Transport'       and kind = 'expense';
  select id into cat_sante   from public.categories where space_id = spc and name = 'Santé'           and kind = 'expense';
  select id into cat_loisir  from public.categories where space_id = spc and name = 'Loisirs'         and kind = 'expense';
  select id into cat_resto   from public.categories where space_id = spc and name = 'Restaurants'     and kind = 'expense';
  select id into cat_abo     from public.categories where space_id = spc and name = 'Abonnements'     and kind = 'expense';
  select id into cat_salaire from public.categories where space_id = spc and name = 'Salaire'         and kind = 'income';
  select id into cat_freelan from public.categories where space_id = spc and name = 'Freelance'       and kind = 'income';
  select id into cat_remb    from public.categories where space_id = spc and name = 'Remboursement'   and kind = 'income';
  select id into cat_virt    from public.categories where space_id = spc and name = 'Virement interne' and kind = 'transfer';
  select id into cat_vetement from public.categories where space_id = spc and name = 'Vêtements'       and kind = 'expense';
  select id into cat_voyage  from public.categories where space_id = spc and name = 'Voyages'          and kind = 'expense';
  select id into cat_educ    from public.categories where space_id = spc and name = 'Education'        and kind = 'expense';
  select id into cat_cadeau  from public.categories where space_id = spc and name = 'Cadeaux'           and kind = 'expense';
  select id into cat_banque  from public.categories where space_id = spc and name = 'Banque & Frais'   and kind = 'expense';
  select id into cat_autrerev from public.categories where space_id = spc and name = 'Autre revenu'    and kind = 'income';

  -- ============================================================
  -- 3. Comptes
  -- ============================================================
  insert into public.accounts (id, space_id, user_id, name, type, initial_balance_cents, currency) values
    (acc_courant, spc, uid, 'BNP Compte courant',  'courant', 150000,  'EUR'),
    (acc_epargne, spc, uid, 'Livret A',             'livret',  500000,  'EUR'),
    (acc_livret,  spc, uid, 'PEL CIC',              'PEL',     1200000, 'EUR')
  on conflict (id) do nothing;

  -- ============================================================
  -- 4. Transactions — historique long (janv. 2024 → mars 2026)
  -- Permet de tester les filtres 3m / 6m / 1an / 2ans / Tout
  -- sur le graphique « Évolution du solde ».
  -- Dépenses en cents négatifs (convention app).
  -- ============================================================
  hist_month := date '2024-01-01';
  hist_i := 0;
  while hist_month < date '2026-04-01' loop
    hist_i := hist_i + 1;
    month_lbl := to_char(hist_month, 'YYYY-MM');

    insert into public.transactions
      (space_id, user_id, account_id, category_id, kind, amount_cents, date, description)
    values
      -- Salaire (5 du mois)
      (spc, uid, acc_courant, cat_salaire, 'income', 285000,
        (hist_month + 4)::timestamptz, 'Salaire ' || month_lbl),
      -- Loyer (1er)
      (spc, uid, acc_courant, cat_loge, 'expense', -85000,
        hist_month::timestamptz, 'Loyer ' || month_lbl),
      -- Navigo (4)
      (spc, uid, acc_courant, cat_trans, 'expense', -8400,
        (hist_month + 3)::timestamptz, 'Navigo mensuel'),
      -- Netflix (10)
      (spc, uid, acc_courant, cat_abo, 'expense', -1799,
        (hist_month + 9)::timestamptz, 'Netflix'),
      -- Courses variables (8)
      (spc, uid, acc_courant, cat_alim, 'expense', -(9000 + (hist_i % 6) * 700),
        (hist_month + 7)::timestamptz, 'Courses ' || month_lbl);

    -- Freelance trimestriel → variation visible sur le solde
    if hist_i % 3 = 0 then
      insert into public.transactions
        (space_id, user_id, account_id, category_id, kind, amount_cents, date, description)
      values
        (spc, uid, acc_courant, cat_freelan, 'income', 45000 + (hist_i % 4) * 10000,
          (hist_month + 14)::timestamptz, 'Mission freelance — ' || month_lbl);
    end if;

    -- Petite dépense resto annuelle (juin) pour casser la monotonie
    if extract(month from hist_month) = 6 then
      insert into public.transactions
        (space_id, user_id, account_id, category_id, kind, amount_cents, date, description)
      values
        (spc, uid, acc_courant, cat_resto, 'expense', -12500,
          (hist_month + 19)::timestamptz, 'Restaurant été ' || extract(year from hist_month)::text);
    end if;

    hist_month := (hist_month + interval '1 month')::date;
  end loop;

  -- ============================================================
  -- 4b. Transactions détaillées — avril & mai 2026
  -- ============================================================
  insert into public.transactions
    (space_id, user_id, account_id, category_id, kind, amount_cents, date, description)
  values
    -- Revenus
    (spc, uid, acc_courant, cat_salaire, 'income',  285000, '2026-05-05 00:00:00+00', 'Salaire mai 2026'),
    (spc, uid, acc_courant, cat_freelan, 'income',   75000, '2026-05-12 00:00:00+00', 'Mission UX — client Acme'),
    (spc, uid, acc_courant, cat_remb,    'income',    3200, '2026-05-18 00:00:00+00', 'Remboursement mutuelle'),

    -- Dépenses (cents négatifs)
    (spc, uid, acc_courant, cat_loge,   'expense', -85000,  '2026-05-01 00:00:00+00', 'Loyer mai'),
    (spc, uid, acc_courant, cat_alim,   'expense',  -9850,  '2026-05-03 00:00:00+00', 'Courses Carrefour'),
    (spc, uid, acc_courant, cat_trans,  'expense',  -8400,  '2026-05-04 00:00:00+00', 'Navigo mensuel'),
    (spc, uid, acc_courant, cat_resto,  'expense',  -3200,  '2026-05-07 00:00:00+00', 'Déjeuner équipe'),
    (spc, uid, acc_courant, cat_abo,    'expense',  -1799,  '2026-05-10 00:00:00+00', 'Netflix'),
    (spc, uid, acc_courant, cat_sante,  'expense',  -4500,  '2026-05-14 00:00:00+00', 'Dentiste'),
    (spc, uid, acc_courant, cat_loisir, 'expense',  -2999,  '2026-05-16 00:00:00+00', 'Spotify Premium'),
    (spc, uid, acc_courant, cat_alim,   'expense', -12350,  '2026-05-17 00:00:00+00', 'Courses Monoprix'),
    (spc, uid, acc_courant, cat_resto,  'expense',  -5600,  '2026-05-20 00:00:00+00', 'Restaurant L''Étoile'),
    (spc, uid, acc_courant, cat_abo,    'expense',   -999,  '2026-05-22 00:00:00+00', 'iCloud 50 Go'),
    (spc, uid, acc_courant, cat_trans,  'expense',  -6500,  '2026-05-24 00:00:00+00', 'Essence Total'),
    (spc, uid, acc_courant, cat_loisir, 'expense',  -1800,  '2026-05-26 00:00:00+00', 'Cinéma × 2'),

    -- Transactions avril 2026
    (spc, uid, acc_courant, cat_salaire, 'income',  285000, '2026-04-05 00:00:00+00', 'Salaire avril 2026'),
    (spc, uid, acc_courant, cat_loge,   'expense', -85000,  '2026-04-01 00:00:00+00', 'Loyer avril'),
    (spc, uid, acc_courant, cat_alim,   'expense', -11200,  '2026-04-08 00:00:00+00', 'Courses Grand Frais'),
    (spc, uid, acc_courant, cat_resto,  'expense',  -4200,  '2026-04-15 00:00:00+00', 'Brunch du dimanche'),
    (spc, uid, acc_courant, cat_trans,  'expense',  -8400,  '2026-04-04 00:00:00+00', 'Navigo mensuel'),
    (spc, uid, acc_courant, cat_abo,    'expense',  -1799,  '2026-04-10 00:00:00+00', 'Netflix'),

    -- Transactions sur livret A
    (spc, uid, acc_epargne, cat_remb,   'income',   10000,  '2026-05-01 00:00:00+00', 'Intérêts livret A');

  -- Virement interne (courant → livret A) — débit négatif / crédit positif
  insert into public.transactions
    (space_id, user_id, account_id, category_id, transfer_id, kind, amount_cents, date, description)
  values
    (spc, uid, acc_courant, cat_virt, transfer_id, 'transfer_debit', -20000, '2026-05-25 00:00:00+00', 'Virement vers Livret A'),
    (spc, uid, acc_epargne, cat_virt, transfer_id, 'transfer_credit', 20000, '2026-05-25 00:00:00+00', 'Virement depuis BNP');

  -- ============================================================
  -- 4c. Transactions détaillées — juin → sept. 2026 (3 derniers mois pleins
  -- + mois en cours), sur les 3 comptes, pour exercer tous les graphiques :
  -- barres revenus/dépenses, donut par catégorie, courbe de solde par compte,
  -- et virements croisés entre les 3 comptes.
  -- ============================================================
  insert into public.transactions
    (space_id, user_id, account_id, category_id, kind, amount_cents, date, description)
  values
    -- ---------- Juin 2026 (compte courant) ----------
    (spc, uid, acc_courant, cat_salaire,  'income',  285000, '2026-06-05 00:00:00+00', 'Salaire juin 2026'),
    (spc, uid, acc_courant, cat_freelan,  'income',   60000, '2026-06-18 00:00:00+00', 'Mission freelance — refonte site'),
    (spc, uid, acc_courant, cat_autrerev, 'income',    3000, '2026-06-30 00:00:00+00', 'Cashback carte bancaire'),
    (spc, uid, acc_courant, cat_loge,     'expense', -85000, '2026-06-01 00:00:00+00', 'Loyer juin'),
    (spc, uid, acc_courant, cat_trans,    'expense',  -8400, '2026-06-04 00:00:00+00', 'Navigo mensuel'),
    (spc, uid, acc_courant, cat_alim,     'expense',  -9800, '2026-06-03 00:00:00+00', 'Courses Carrefour'),
    (spc, uid, acc_courant, cat_resto,    'expense',  -4200, '2026-06-12 00:00:00+00', 'Déjeuner équipe'),
    (spc, uid, acc_courant, cat_abo,      'expense',  -1799, '2026-06-10 00:00:00+00', 'Netflix'),
    (spc, uid, acc_courant, cat_vetement, 'expense',  -7800, '2026-06-20 00:00:00+00', 'Zara — vestiaire été'),
    (spc, uid, acc_courant, cat_cadeau,   'expense',  -6000, '2026-06-21 00:00:00+00', 'Cadeau fête des pères'),
    (spc, uid, acc_courant, cat_alim,     'expense', -11200, '2026-06-15 00:00:00+00', 'Courses Monoprix'),
    (spc, uid, acc_courant, cat_loisir,   'expense',  -2999, '2026-06-16 00:00:00+00', 'Spotify Premium'),
    (spc, uid, acc_courant, cat_resto,    'expense',  -6800, '2026-06-27 00:00:00+00', 'Restaurant anniversaire'),
    (spc, uid, acc_courant, cat_alim,     'expense',  -8700, '2026-06-24 00:00:00+00', 'Courses Franprix'),
    (spc, uid, acc_courant, cat_abo,      'expense',   -999, '2026-06-22 00:00:00+00', 'iCloud 50 Go'),
    (spc, uid, acc_courant, cat_banque,   'expense',   -250, '2026-06-28 00:00:00+00', 'Frais de tenue de compte'),

    -- ---------- Juillet 2026 (compte courant) ----------
    (spc, uid, acc_courant, cat_salaire,  'income',  285000, '2026-07-05 00:00:00+00', 'Salaire juillet 2026'),
    (spc, uid, acc_courant, cat_remb,     'income',    4200, '2026-07-22 00:00:00+00', 'Remboursement mutuelle'),
    (spc, uid, acc_courant, cat_loge,     'expense', -85000, '2026-07-01 00:00:00+00', 'Loyer juillet'),
    (spc, uid, acc_courant, cat_trans,    'expense',  -8400, '2026-07-04 00:00:00+00', 'Navigo mensuel'),
    (spc, uid, acc_courant, cat_alim,     'expense', -10500, '2026-07-02 00:00:00+00', 'Courses Carrefour'),
    (spc, uid, acc_courant, cat_sante,    'expense',  -3500, '2026-07-09 00:00:00+00', 'Consultation médecin'),
    (spc, uid, acc_courant, cat_abo,      'expense',  -1799, '2026-07-10 00:00:00+00', 'Netflix'),
    (spc, uid, acc_courant, cat_alim,     'expense',  -9200, '2026-07-14 00:00:00+00', 'Courses Monoprix'),
    (spc, uid, acc_courant, cat_loisir,   'expense',  -2999, '2026-07-16 00:00:00+00', 'Spotify Premium'),
    (spc, uid, acc_courant, cat_resto,    'expense',  -5400, '2026-07-19 00:00:00+00', 'Restaurant terrasse'),
    (spc, uid, acc_courant, cat_alim,     'expense', -12100, '2026-07-23 00:00:00+00', 'Courses Franprix'),
    (spc, uid, acc_courant, cat_abo,      'expense',   -999, '2026-07-22 00:00:00+00', 'iCloud 50 Go'),
    (spc, uid, acc_courant, cat_banque,   'expense',   -250, '2026-07-28 00:00:00+00', 'Frais de tenue de compte'),

    -- ---------- Août 2026 (compte courant) — mois des vacances ----------
    (spc, uid, acc_courant, cat_salaire,  'income',  285000, '2026-08-05 00:00:00+00', 'Salaire août 2026'),
    (spc, uid, acc_courant, cat_freelan,  'income',   55000, '2026-08-25 00:00:00+00', 'Mission freelance — audit UX'),
    (spc, uid, acc_courant, cat_loge,     'expense', -85000, '2026-08-01 00:00:00+00', 'Loyer août'),
    (spc, uid, acc_courant, cat_vetement, 'expense', -12000, '2026-08-02 00:00:00+00', 'Vêtements vacances'),
    (spc, uid, acc_courant, cat_voyage,   'expense', -45000, '2026-08-06 00:00:00+00', 'Hôtel — vacances été'),
    (spc, uid, acc_courant, cat_voyage,   'expense', -18000, '2026-08-07 00:00:00+00', 'Billets de train'),
    (spc, uid, acc_courant, cat_resto,    'expense',  -9200, '2026-08-08 00:00:00+00', 'Restaurant en vacances'),
    (spc, uid, acc_courant, cat_trans,    'expense',  -8400, '2026-08-04 00:00:00+00', 'Navigo mensuel'),
    (spc, uid, acc_courant, cat_alim,     'expense',  -8900, '2026-08-03 00:00:00+00', 'Courses avant départ'),
    (spc, uid, acc_courant, cat_sante,    'expense',  -6200, '2026-08-14 00:00:00+00', 'Pharmacie'),
    (spc, uid, acc_courant, cat_cadeau,   'expense',  -4500, '2026-08-15 00:00:00+00', 'Cadeau anniversaire ami'),
    (spc, uid, acc_courant, cat_alim,     'expense',  -7600, '2026-08-18 00:00:00+00', 'Courses Monoprix'),
    (spc, uid, acc_courant, cat_abo,      'expense',  -1799, '2026-08-10 00:00:00+00', 'Netflix'),
    (spc, uid, acc_courant, cat_loisir,   'expense',  -2999, '2026-08-16 00:00:00+00', 'Spotify Premium'),
    (spc, uid, acc_courant, cat_abo,      'expense',   -999, '2026-08-22 00:00:00+00', 'iCloud 50 Go'),
    (spc, uid, acc_courant, cat_resto,    'expense',  -3100, '2026-08-22 00:00:00+00', 'Déjeuner rentrée'),
    (spc, uid, acc_courant, cat_banque,   'expense',   -250, '2026-08-28 00:00:00+00', 'Frais de tenue de compte'),

    -- ---------- Septembre 2026 (compte courant, mois en cours au 03/09) ----------
    (spc, uid, acc_courant, cat_autrerev, 'income',    1500, '2026-09-02 00:00:00+00', 'Vente objet occasion'),
    (spc, uid, acc_courant, cat_loge,     'expense', -85000, '2026-09-01 00:00:00+00', 'Loyer septembre'),
    (spc, uid, acc_courant, cat_alim,     'expense', -10200, '2026-09-02 00:00:00+00', 'Courses Carrefour'),
    (spc, uid, acc_courant, cat_educ,     'expense', -15000, '2026-09-01 00:00:00+00', 'Rentrée — fournitures & formation'),
    (spc, uid, acc_courant, cat_resto,    'expense',  -2800, '2026-09-03 00:00:00+00', 'Déjeuner client'),

    -- ---------- Livret A — intérêts mensuels + rachat/versement ----------
    (spc, uid, acc_epargne, cat_remb, 'income', 1800, '2026-06-01 00:00:00+00', 'Intérêts Livret A — juin'),
    (spc, uid, acc_epargne, cat_remb, 'income', 1850, '2026-07-01 00:00:00+00', 'Intérêts Livret A — juillet'),
    (spc, uid, acc_epargne, cat_remb, 'income', 1900, '2026-08-01 00:00:00+00', 'Intérêts Livret A — août'),
    (spc, uid, acc_epargne, cat_remb, 'income', 1950, '2026-09-01 00:00:00+00', 'Intérêts Livret A — septembre'),

    -- ---------- PEL CIC — intérêts semestriels ----------
    (spc, uid, acc_livret, cat_remb, 'income', 3200, '2026-06-30 00:00:00+00', 'Intérêts PEL — 1er semestre 2026');

  -- Virements croisés entre les 3 comptes (débit négatif / crédit positif)
  insert into public.transactions
    (space_id, user_id, account_id, category_id, transfer_id, kind, amount_cents, date, description)
  values
    -- Juin : épargne mensuelle courant → épargne
    (spc, uid, acc_courant, cat_virt, tr_jun_ce, 'transfer_debit',  -30000, '2026-06-25 00:00:00+00', 'Virement mensuel épargne'),
    (spc, uid, acc_epargne, cat_virt, tr_jun_ce, 'transfer_credit',  30000, '2026-06-25 00:00:00+00', 'Virement depuis BNP'),

    -- Juillet : retrait du Livret A pour financer les vacances
    (spc, uid, acc_epargne, cat_virt, tr_jul_ec, 'transfer_debit',  -50000, '2026-07-10 00:00:00+00', 'Retrait pour vacances'),
    (spc, uid, acc_courant, cat_virt, tr_jul_ec, 'transfer_credit',  50000, '2026-07-10 00:00:00+00', 'Virement depuis Livret A'),

    -- Juillet : épargne mensuelle courant → épargne
    (spc, uid, acc_courant, cat_virt, tr_jul_ce, 'transfer_debit',  -25000, '2026-07-26 00:00:00+00', 'Virement mensuel épargne'),
    (spc, uid, acc_epargne, cat_virt, tr_jul_ce, 'transfer_credit',  25000, '2026-07-26 00:00:00+00', 'Virement depuis BNP'),

    -- Août : versement PEL depuis le courant
    (spc, uid, acc_courant, cat_virt, tr_aug_cp, 'transfer_debit', -150000, '2026-08-05 00:00:00+00', 'Versement PEL'),
    (spc, uid, acc_livret,  cat_virt, tr_aug_cp, 'transfer_credit', 150000, '2026-08-05 00:00:00+00', 'Virement depuis BNP'),

    -- Août : réallocation Livret A → PEL
    (spc, uid, acc_epargne, cat_virt, tr_aug_ep, 'transfer_debit',  -40000, '2026-08-20 00:00:00+00', 'Réallocation vers PEL'),
    (spc, uid, acc_livret,  cat_virt, tr_aug_ep, 'transfer_credit',  40000, '2026-08-20 00:00:00+00', 'Virement depuis Livret A'),

    -- Août : épargne mensuelle courant → épargne
    (spc, uid, acc_courant, cat_virt, tr_aug_ce, 'transfer_debit',  -30000, '2026-08-27 00:00:00+00', 'Virement mensuel épargne'),
    (spc, uid, acc_epargne, cat_virt, tr_aug_ce, 'transfer_credit',  30000, '2026-08-27 00:00:00+00', 'Virement depuis BNP'),

    -- Septembre : épargne mensuelle courant → épargne
    (spc, uid, acc_courant, cat_virt, tr_sep_ce, 'transfer_debit',  -20000, '2026-09-02 00:00:00+00', 'Virement mensuel épargne'),
    (spc, uid, acc_epargne, cat_virt, tr_sep_ce, 'transfer_credit',  20000, '2026-09-02 00:00:00+00', 'Virement depuis BNP');

  -- ============================================================
  -- 5. Budgets — mai → sept. 2026
  -- ============================================================
  insert into public.budgets (space_id, user_id, category_id, month, amount_cents) values
    (spc, uid, cat_alim,   '2026-05-01', 30000),
    (spc, uid, cat_loge,   '2026-05-01', 90000),
    (spc, uid, cat_trans,  '2026-05-01', 15000),
    (spc, uid, cat_sante,  '2026-05-01', 10000),
    (spc, uid, cat_loisir, '2026-05-01', 8000),
    (spc, uid, cat_resto,  '2026-05-01', 12000),
    (spc, uid, cat_abo,    '2026-05-01', 5000),

    -- Juin 2026
    (spc, uid, cat_alim,     '2026-06-01', 30000),
    (spc, uid, cat_loge,     '2026-06-01', 90000),
    (spc, uid, cat_trans,    '2026-06-01', 15000),
    (spc, uid, cat_loisir,   '2026-06-01', 8000),
    (spc, uid, cat_resto,    '2026-06-01', 12000),
    (spc, uid, cat_abo,      '2026-06-01', 5000),
    (spc, uid, cat_vetement, '2026-06-01', 6000),
    (spc, uid, cat_cadeau,   '2026-06-01', 5000),

    -- Juillet 2026
    (spc, uid, cat_alim,   '2026-07-01', 30000),
    (spc, uid, cat_loge,   '2026-07-01', 90000),
    (spc, uid, cat_trans,  '2026-07-01', 15000),
    (spc, uid, cat_sante,  '2026-07-01', 10000),
    (spc, uid, cat_loisir, '2026-07-01', 8000),
    (spc, uid, cat_resto,  '2026-07-01', 12000),
    (spc, uid, cat_abo,    '2026-07-01', 5000),

    -- Août 2026 — budget voyages volontairement dépassé (63k dépensés / 30k prévus)
    (spc, uid, cat_alim,     '2026-08-01', 30000),
    (spc, uid, cat_loge,     '2026-08-01', 90000),
    (spc, uid, cat_trans,    '2026-08-01', 15000),
    (spc, uid, cat_sante,    '2026-08-01', 10000),
    (spc, uid, cat_loisir,   '2026-08-01', 8000),
    (spc, uid, cat_resto,    '2026-08-01', 12000),
    (spc, uid, cat_abo,      '2026-08-01', 5000),
    (spc, uid, cat_vetement, '2026-08-01', 8000),
    (spc, uid, cat_voyage,   '2026-08-01', 30000),
    (spc, uid, cat_cadeau,   '2026-08-01', 5000),

    -- Septembre 2026 (mois en cours) — budget alimentation volontairement
    -- trop bas pour déclencher l'alerte « budget dépassé » sur le dashboard
    (spc, uid, cat_alim,   '2026-09-01', 5000),
    (spc, uid, cat_loge,   '2026-09-01', 90000),
    (spc, uid, cat_trans,  '2026-09-01', 15000),
    (spc, uid, cat_educ,   '2026-09-01', 10000),
    (spc, uid, cat_resto,  '2026-09-01', 12000),
    (spc, uid, cat_abo,    '2026-09-01', 5000)
  on conflict (space_id, category_id, month) do nothing;

  -- ============================================================
  -- 6. Charges fixes
  -- ============================================================
  insert into public.fixed_charges
    (space_id, user_id, name, amount_cents, frequency, next_due_date, account_id, category_id, notes, status)
  values
    (spc, uid, 'Loyer',              85000, 'monthly',   '2026-10-01', acc_courant, cat_loge,   'Virement proprio',        'active'),
    (spc, uid, 'Navigo mensuel',      8400, 'monthly',   '2026-10-04', acc_courant, cat_trans,  'Rechargement station',    'active'),
    (spc, uid, 'Netflix',             1799, 'monthly',   '2026-10-10', acc_courant, cat_abo,    null,                      'active'),
    (spc, uid, 'Spotify',             2999, 'monthly',   '2026-10-16', acc_courant, cat_loisir, null,                      'active'),
    (spc, uid, 'iCloud 50 Go',         999, 'monthly',   '2026-10-22', acc_courant, cat_abo,    null,                      'active'),
    (spc, uid, 'Assurance auto',      9800, 'quarterly', '2026-09-08', acc_courant, cat_banque, 'Prélèvement trimestriel', 'active'),
    (spc, uid, 'Assurance habitation',7200, 'yearly',    '2027-01-15', acc_courant, null,        'Prélevement annuel AXA',  'active'),
    (spc, uid, 'Taxe foncière',      45000, 'yearly',    '2026-10-15', acc_courant, null,        null,                      'active')
  on conflict do nothing;

  -- ============================================================
  -- 7. Objectifs d'épargne
  -- ============================================================
  insert into public.savings_goals
    (space_id, user_id, name, target_amount_cents, current_amount_cents, currency, deadline)
  values
    (spc, uid, 'Voyage au Japon',   400000, 165000, 'EUR', '2026-12-31'),
    (spc, uid, 'Fonds d''urgence',  300000, 230000, 'EUR', null),
    (spc, uid, 'Nouvelle voiture', 1500000, 510000, 'EUR', '2028-06-01')
  on conflict do nothing;

  -- ============================================================
  -- 8. Règles d'import CSV
  -- ============================================================
  insert into public.csv_import_rules (space_id, user_id, keyword, category_id, kind) values
    (spc, uid, 'CARREFOUR',   cat_alim,   'expense'),
    (spc, uid, 'MONOPRIX',    cat_alim,   'expense'),
    (spc, uid, 'FRANPRIX',    cat_alim,   'expense'),
    (spc, uid, 'SNCF',        cat_trans,  'expense'),
    (spc, uid, 'TOTAL',       cat_trans,  'expense'),
    (spc, uid, 'RATP',        cat_trans,  'expense'),
    (spc, uid, 'NETFLIX',     cat_abo,    'expense'),
    (spc, uid, 'SPOTIFY',     cat_abo,    'expense'),
    (spc, uid, 'APPLE',       cat_abo,    'expense'),
    (spc, uid, 'UBER EATS',   cat_resto,  'expense'),
    (spc, uid, 'DELIVEROO',   cat_resto,  'expense'),
    (spc, uid, 'VIR SALAIRE', cat_salaire,'income')
  on conflict do nothing;

end $$;

-- ============================================================
-- 9. Espace commun de démonstration
--    Bob (bob@budget.local / Password1234!) partage l'espace « Foyer »
--    avec Alice. Une invitation en attente permet de tester l'acceptation.
-- ============================================================
insert into auth.users (
  id, instance_id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, confirmation_token, recovery_token,
  email_change_token_new, email_change
) values (
  'a0000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated',
  'bob@budget.local',
  crypt('Password1234!', gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Bob Martin"}',
  false, '', '', '', ''
) on conflict (id) do nothing;

insert into auth.identities (
  id, user_id, provider_id, provider,
  identity_data, last_sign_in_at, created_at, updated_at
) values (
  'a0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000002',
  'bob@budget.local', 'email',
  '{"sub":"a0000000-0000-0000-0000-000000000002","email":"bob@budget.local"}',
  now(), now(), now()
) on conflict (provider, provider_id) do nothing;

insert into public.spaces (id, name, kind, created_by)
values ('c0000000-0000-0000-0000-000000000001', 'Foyer', 'shared', 'a0000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.space_members (space_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'member')
on conflict do nothing;

select public.seed_default_categories(
  'c0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001'
);

insert into public.accounts (id, space_id, user_id, name, type, initial_balance_cents, currency) values
  ('b0000000-0000-0000-0000-000000000010', 'c0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', 'Compte joint', 'courant', 200000, 'EUR')
on conflict (id) do nothing;

insert into public.invitations
  (inviter_user_id, space_id, invitee_email, token, status)
values
  ('a0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
   'carol@example.com', 'test-invite-token-carol', 'pending')
on conflict do nothing;

-- ============================================================
-- 10. Dépenses partagées (phase 2) dans « Foyer »
--     Alice partage des dépenses de son compte perso : le loyer et les
--     courses (mai → sept. 2026) avec des catégories communes, pour que le
--     solde, le budget commun, le dashboard et les analyses de l'espace
--     commun aient de quoi afficher. Loyer 50/50, courses 60/40 (Alice/Bob).
-- ============================================================
insert into public.shared_expenses (space_id, source_transaction_id, paid_by, category_id, shares)
select
  'c0000000-0000-0000-0000-000000000001',
  t.id,
  'a0000000-0000-0000-0000-000000000001',
  (select c.id from public.categories c
    where c.space_id = 'c0000000-0000-0000-0000-000000000001'
      and c.kind = 'expense'
      and c.name = case when t.description ilike 'Loyer%' then 'Logement' else 'Alimentation' end),
  case
    when t.description ilike 'Loyer%'
      then jsonb_build_object('a0000000-0000-0000-0000-000000000001', 50, 'a0000000-0000-0000-0000-000000000002', 50)
    else jsonb_build_object('a0000000-0000-0000-0000-000000000001', 60, 'a0000000-0000-0000-0000-000000000002', 40)
  end
from public.transactions t
where t.user_id = 'a0000000-0000-0000-0000-000000000001'
  and t.space_id = public.personal_space_id('a0000000-0000-0000-0000-000000000001')
  and t.kind = 'expense'
  and t.transfer_id is null
  and t.deleted_at is null
  and (t.description ilike 'Loyer%' or t.description ilike 'Courses%')
  and t.date >= '2026-05-01'
on conflict (source_transaction_id) do nothing;

-- Bob a déjà remboursé une partie (saisie manuelle).
insert into public.settlements (space_id, from_user, to_user, amount_cents, date, created_by)
values ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
        'a0000000-0000-0000-0000-000000000001', 30000, '2026-08-05 12:00:00+00',
        'a0000000-0000-0000-0000-000000000002');
