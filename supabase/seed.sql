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
  select id into cat_vetement from public.categories where user_id = uid and name = 'Vêtements'       and kind = 'expense';
  select id into cat_voyage  from public.categories where user_id = uid and name = 'Voyages'          and kind = 'expense';
  select id into cat_educ    from public.categories where user_id = uid and name = 'Education'        and kind = 'expense';
  select id into cat_cadeau  from public.categories where user_id = uid and name = 'Cadeaux'           and kind = 'expense';
  select id into cat_banque  from public.categories where user_id = uid and name = 'Banque & Frais'   and kind = 'expense';
  select id into cat_autrerev from public.categories where user_id = uid and name = 'Autre revenu'    and kind = 'income';

  -- ============================================================
  -- 3. Comptes
  -- ============================================================
  insert into public.accounts (id, user_id, name, type, initial_balance_cents, currency) values
    (acc_courant, uid, 'BNP Compte courant',  'courant', 150000,  'EUR'),
    (acc_epargne, uid, 'Livret A',             'livret',  500000,  'EUR'),
    (acc_livret,  uid, 'PEL CIC',              'PEL',     1200000, 'EUR')
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
      (user_id, account_id, category_id, kind, amount_cents, date, description)
    values
      -- Salaire (5 du mois)
      (uid, acc_courant, cat_salaire, 'income', 285000,
        (hist_month + 4)::timestamptz, 'Salaire ' || month_lbl),
      -- Loyer (1er)
      (uid, acc_courant, cat_loge, 'expense', -85000,
        hist_month::timestamptz, 'Loyer ' || month_lbl),
      -- Navigo (4)
      (uid, acc_courant, cat_trans, 'expense', -8400,
        (hist_month + 3)::timestamptz, 'Navigo mensuel'),
      -- Netflix (10)
      (uid, acc_courant, cat_abo, 'expense', -1799,
        (hist_month + 9)::timestamptz, 'Netflix'),
      -- Courses variables (8)
      (uid, acc_courant, cat_alim, 'expense', -(9000 + (hist_i % 6) * 700),
        (hist_month + 7)::timestamptz, 'Courses ' || month_lbl);

    -- Freelance trimestriel → variation visible sur le solde
    if hist_i % 3 = 0 then
      insert into public.transactions
        (user_id, account_id, category_id, kind, amount_cents, date, description)
      values
        (uid, acc_courant, cat_freelan, 'income', 45000 + (hist_i % 4) * 10000,
          (hist_month + 14)::timestamptz, 'Mission freelance — ' || month_lbl);
    end if;

    -- Petite dépense resto annuelle (juin) pour casser la monotonie
    if extract(month from hist_month) = 6 then
      insert into public.transactions
        (user_id, account_id, category_id, kind, amount_cents, date, description)
      values
        (uid, acc_courant, cat_resto, 'expense', -12500,
          (hist_month + 19)::timestamptz, 'Restaurant été ' || extract(year from hist_month)::text);
    end if;

    hist_month := (hist_month + interval '1 month')::date;
  end loop;

  -- ============================================================
  -- 4b. Transactions détaillées — avril & mai 2026
  -- ============================================================
  insert into public.transactions
    (user_id, account_id, category_id, kind, amount_cents, date, description)
  values
    -- Revenus
    (uid, acc_courant, cat_salaire, 'income',  285000, '2026-05-05 00:00:00+00', 'Salaire mai 2026'),
    (uid, acc_courant, cat_freelan, 'income',   75000, '2026-05-12 00:00:00+00', 'Mission UX — client Acme'),
    (uid, acc_courant, cat_remb,    'income',    3200, '2026-05-18 00:00:00+00', 'Remboursement mutuelle'),

    -- Dépenses (cents négatifs)
    (uid, acc_courant, cat_loge,   'expense', -85000,  '2026-05-01 00:00:00+00', 'Loyer mai'),
    (uid, acc_courant, cat_alim,   'expense',  -9850,  '2026-05-03 00:00:00+00', 'Courses Carrefour'),
    (uid, acc_courant, cat_trans,  'expense',  -8400,  '2026-05-04 00:00:00+00', 'Navigo mensuel'),
    (uid, acc_courant, cat_resto,  'expense',  -3200,  '2026-05-07 00:00:00+00', 'Déjeuner équipe'),
    (uid, acc_courant, cat_abo,    'expense',  -1799,  '2026-05-10 00:00:00+00', 'Netflix'),
    (uid, acc_courant, cat_sante,  'expense',  -4500,  '2026-05-14 00:00:00+00', 'Dentiste'),
    (uid, acc_courant, cat_loisir, 'expense',  -2999,  '2026-05-16 00:00:00+00', 'Spotify Premium'),
    (uid, acc_courant, cat_alim,   'expense', -12350,  '2026-05-17 00:00:00+00', 'Courses Monoprix'),
    (uid, acc_courant, cat_resto,  'expense',  -5600,  '2026-05-20 00:00:00+00', 'Restaurant L''Étoile'),
    (uid, acc_courant, cat_abo,    'expense',   -999,  '2026-05-22 00:00:00+00', 'iCloud 50 Go'),
    (uid, acc_courant, cat_trans,  'expense',  -6500,  '2026-05-24 00:00:00+00', 'Essence Total'),
    (uid, acc_courant, cat_loisir, 'expense',  -1800,  '2026-05-26 00:00:00+00', 'Cinéma × 2'),

    -- Transactions avril 2026
    (uid, acc_courant, cat_salaire, 'income',  285000, '2026-04-05 00:00:00+00', 'Salaire avril 2026'),
    (uid, acc_courant, cat_loge,   'expense', -85000,  '2026-04-01 00:00:00+00', 'Loyer avril'),
    (uid, acc_courant, cat_alim,   'expense', -11200,  '2026-04-08 00:00:00+00', 'Courses Grand Frais'),
    (uid, acc_courant, cat_resto,  'expense',  -4200,  '2026-04-15 00:00:00+00', 'Brunch du dimanche'),
    (uid, acc_courant, cat_trans,  'expense',  -8400,  '2026-04-04 00:00:00+00', 'Navigo mensuel'),
    (uid, acc_courant, cat_abo,    'expense',  -1799,  '2026-04-10 00:00:00+00', 'Netflix'),

    -- Transactions sur livret A
    (uid, acc_epargne, cat_remb,   'income',   10000,  '2026-05-01 00:00:00+00', 'Intérêts livret A');

  -- Virement interne (courant → livret A) — débit négatif / crédit positif
  insert into public.transactions
    (user_id, account_id, category_id, transfer_id, kind, amount_cents, date, description)
  values
    (uid, acc_courant, cat_virt, transfer_id, 'transfer_debit', -20000, '2026-05-25 00:00:00+00', 'Virement vers Livret A'),
    (uid, acc_epargne, cat_virt, transfer_id, 'transfer_credit', 20000, '2026-05-25 00:00:00+00', 'Virement depuis BNP');

  -- ============================================================
  -- 4c. Transactions détaillées — juin → sept. 2026 (3 derniers mois pleins
  -- + mois en cours), sur les 3 comptes, pour exercer tous les graphiques :
  -- barres revenus/dépenses, donut par catégorie, courbe de solde par compte,
  -- et virements croisés entre les 3 comptes.
  -- ============================================================
  insert into public.transactions
    (user_id, account_id, category_id, kind, amount_cents, date, description)
  values
    -- ---------- Juin 2026 (compte courant) ----------
    (uid, acc_courant, cat_salaire,  'income',  285000, '2026-06-05 00:00:00+00', 'Salaire juin 2026'),
    (uid, acc_courant, cat_freelan,  'income',   60000, '2026-06-18 00:00:00+00', 'Mission freelance — refonte site'),
    (uid, acc_courant, cat_autrerev, 'income',    3000, '2026-06-30 00:00:00+00', 'Cashback carte bancaire'),
    (uid, acc_courant, cat_loge,     'expense', -85000, '2026-06-01 00:00:00+00', 'Loyer juin'),
    (uid, acc_courant, cat_trans,    'expense',  -8400, '2026-06-04 00:00:00+00', 'Navigo mensuel'),
    (uid, acc_courant, cat_alim,     'expense',  -9800, '2026-06-03 00:00:00+00', 'Courses Carrefour'),
    (uid, acc_courant, cat_resto,    'expense',  -4200, '2026-06-12 00:00:00+00', 'Déjeuner équipe'),
    (uid, acc_courant, cat_abo,      'expense',  -1799, '2026-06-10 00:00:00+00', 'Netflix'),
    (uid, acc_courant, cat_vetement, 'expense',  -7800, '2026-06-20 00:00:00+00', 'Zara — vestiaire été'),
    (uid, acc_courant, cat_cadeau,   'expense',  -6000, '2026-06-21 00:00:00+00', 'Cadeau fête des pères'),
    (uid, acc_courant, cat_alim,     'expense', -11200, '2026-06-15 00:00:00+00', 'Courses Monoprix'),
    (uid, acc_courant, cat_loisir,   'expense',  -2999, '2026-06-16 00:00:00+00', 'Spotify Premium'),
    (uid, acc_courant, cat_resto,    'expense',  -6800, '2026-06-27 00:00:00+00', 'Restaurant anniversaire'),
    (uid, acc_courant, cat_alim,     'expense',  -8700, '2026-06-24 00:00:00+00', 'Courses Franprix'),
    (uid, acc_courant, cat_abo,      'expense',   -999, '2026-06-22 00:00:00+00', 'iCloud 50 Go'),
    (uid, acc_courant, cat_banque,   'expense',   -250, '2026-06-28 00:00:00+00', 'Frais de tenue de compte'),

    -- ---------- Juillet 2026 (compte courant) ----------
    (uid, acc_courant, cat_salaire,  'income',  285000, '2026-07-05 00:00:00+00', 'Salaire juillet 2026'),
    (uid, acc_courant, cat_remb,     'income',    4200, '2026-07-22 00:00:00+00', 'Remboursement mutuelle'),
    (uid, acc_courant, cat_loge,     'expense', -85000, '2026-07-01 00:00:00+00', 'Loyer juillet'),
    (uid, acc_courant, cat_trans,    'expense',  -8400, '2026-07-04 00:00:00+00', 'Navigo mensuel'),
    (uid, acc_courant, cat_alim,     'expense', -10500, '2026-07-02 00:00:00+00', 'Courses Carrefour'),
    (uid, acc_courant, cat_sante,    'expense',  -3500, '2026-07-09 00:00:00+00', 'Consultation médecin'),
    (uid, acc_courant, cat_abo,      'expense',  -1799, '2026-07-10 00:00:00+00', 'Netflix'),
    (uid, acc_courant, cat_alim,     'expense',  -9200, '2026-07-14 00:00:00+00', 'Courses Monoprix'),
    (uid, acc_courant, cat_loisir,   'expense',  -2999, '2026-07-16 00:00:00+00', 'Spotify Premium'),
    (uid, acc_courant, cat_resto,    'expense',  -5400, '2026-07-19 00:00:00+00', 'Restaurant terrasse'),
    (uid, acc_courant, cat_alim,     'expense', -12100, '2026-07-23 00:00:00+00', 'Courses Franprix'),
    (uid, acc_courant, cat_abo,      'expense',   -999, '2026-07-22 00:00:00+00', 'iCloud 50 Go'),
    (uid, acc_courant, cat_banque,   'expense',   -250, '2026-07-28 00:00:00+00', 'Frais de tenue de compte'),

    -- ---------- Août 2026 (compte courant) — mois des vacances ----------
    (uid, acc_courant, cat_salaire,  'income',  285000, '2026-08-05 00:00:00+00', 'Salaire août 2026'),
    (uid, acc_courant, cat_freelan,  'income',   55000, '2026-08-25 00:00:00+00', 'Mission freelance — audit UX'),
    (uid, acc_courant, cat_loge,     'expense', -85000, '2026-08-01 00:00:00+00', 'Loyer août'),
    (uid, acc_courant, cat_vetement, 'expense', -12000, '2026-08-02 00:00:00+00', 'Vêtements vacances'),
    (uid, acc_courant, cat_voyage,   'expense', -45000, '2026-08-06 00:00:00+00', 'Hôtel — vacances été'),
    (uid, acc_courant, cat_voyage,   'expense', -18000, '2026-08-07 00:00:00+00', 'Billets de train'),
    (uid, acc_courant, cat_resto,    'expense',  -9200, '2026-08-08 00:00:00+00', 'Restaurant en vacances'),
    (uid, acc_courant, cat_trans,    'expense',  -8400, '2026-08-04 00:00:00+00', 'Navigo mensuel'),
    (uid, acc_courant, cat_alim,     'expense',  -8900, '2026-08-03 00:00:00+00', 'Courses avant départ'),
    (uid, acc_courant, cat_sante,    'expense',  -6200, '2026-08-14 00:00:00+00', 'Pharmacie'),
    (uid, acc_courant, cat_cadeau,   'expense',  -4500, '2026-08-15 00:00:00+00', 'Cadeau anniversaire ami'),
    (uid, acc_courant, cat_alim,     'expense',  -7600, '2026-08-18 00:00:00+00', 'Courses Monoprix'),
    (uid, acc_courant, cat_abo,      'expense',  -1799, '2026-08-10 00:00:00+00', 'Netflix'),
    (uid, acc_courant, cat_loisir,   'expense',  -2999, '2026-08-16 00:00:00+00', 'Spotify Premium'),
    (uid, acc_courant, cat_abo,      'expense',   -999, '2026-08-22 00:00:00+00', 'iCloud 50 Go'),
    (uid, acc_courant, cat_resto,    'expense',  -3100, '2026-08-22 00:00:00+00', 'Déjeuner rentrée'),
    (uid, acc_courant, cat_banque,   'expense',   -250, '2026-08-28 00:00:00+00', 'Frais de tenue de compte'),

    -- ---------- Septembre 2026 (compte courant, mois en cours au 03/09) ----------
    (uid, acc_courant, cat_autrerev, 'income',    1500, '2026-09-02 00:00:00+00', 'Vente objet occasion'),
    (uid, acc_courant, cat_loge,     'expense', -85000, '2026-09-01 00:00:00+00', 'Loyer septembre'),
    (uid, acc_courant, cat_alim,     'expense', -10200, '2026-09-02 00:00:00+00', 'Courses Carrefour'),
    (uid, acc_courant, cat_educ,     'expense', -15000, '2026-09-01 00:00:00+00', 'Rentrée — fournitures & formation'),
    (uid, acc_courant, cat_resto,    'expense',  -2800, '2026-09-03 00:00:00+00', 'Déjeuner client'),

    -- ---------- Livret A — intérêts mensuels + rachat/versement ----------
    (uid, acc_epargne, cat_remb, 'income', 1800, '2026-06-01 00:00:00+00', 'Intérêts Livret A — juin'),
    (uid, acc_epargne, cat_remb, 'income', 1850, '2026-07-01 00:00:00+00', 'Intérêts Livret A — juillet'),
    (uid, acc_epargne, cat_remb, 'income', 1900, '2026-08-01 00:00:00+00', 'Intérêts Livret A — août'),
    (uid, acc_epargne, cat_remb, 'income', 1950, '2026-09-01 00:00:00+00', 'Intérêts Livret A — septembre'),

    -- ---------- PEL CIC — intérêts semestriels ----------
    (uid, acc_livret, cat_remb, 'income', 3200, '2026-06-30 00:00:00+00', 'Intérêts PEL — 1er semestre 2026');

  -- Virements croisés entre les 3 comptes (débit négatif / crédit positif)
  insert into public.transactions
    (user_id, account_id, category_id, transfer_id, kind, amount_cents, date, description)
  values
    -- Juin : épargne mensuelle courant → épargne
    (uid, acc_courant, cat_virt, tr_jun_ce, 'transfer_debit',  -30000, '2026-06-25 00:00:00+00', 'Virement mensuel épargne'),
    (uid, acc_epargne, cat_virt, tr_jun_ce, 'transfer_credit',  30000, '2026-06-25 00:00:00+00', 'Virement depuis BNP'),

    -- Juillet : retrait du Livret A pour financer les vacances
    (uid, acc_epargne, cat_virt, tr_jul_ec, 'transfer_debit',  -50000, '2026-07-10 00:00:00+00', 'Retrait pour vacances'),
    (uid, acc_courant, cat_virt, tr_jul_ec, 'transfer_credit',  50000, '2026-07-10 00:00:00+00', 'Virement depuis Livret A'),

    -- Juillet : épargne mensuelle courant → épargne
    (uid, acc_courant, cat_virt, tr_jul_ce, 'transfer_debit',  -25000, '2026-07-26 00:00:00+00', 'Virement mensuel épargne'),
    (uid, acc_epargne, cat_virt, tr_jul_ce, 'transfer_credit',  25000, '2026-07-26 00:00:00+00', 'Virement depuis BNP'),

    -- Août : versement PEL depuis le courant
    (uid, acc_courant, cat_virt, tr_aug_cp, 'transfer_debit', -150000, '2026-08-05 00:00:00+00', 'Versement PEL'),
    (uid, acc_livret,  cat_virt, tr_aug_cp, 'transfer_credit', 150000, '2026-08-05 00:00:00+00', 'Virement depuis BNP'),

    -- Août : réallocation Livret A → PEL
    (uid, acc_epargne, cat_virt, tr_aug_ep, 'transfer_debit',  -40000, '2026-08-20 00:00:00+00', 'Réallocation vers PEL'),
    (uid, acc_livret,  cat_virt, tr_aug_ep, 'transfer_credit',  40000, '2026-08-20 00:00:00+00', 'Virement depuis Livret A'),

    -- Août : épargne mensuelle courant → épargne
    (uid, acc_courant, cat_virt, tr_aug_ce, 'transfer_debit',  -30000, '2026-08-27 00:00:00+00', 'Virement mensuel épargne'),
    (uid, acc_epargne, cat_virt, tr_aug_ce, 'transfer_credit',  30000, '2026-08-27 00:00:00+00', 'Virement depuis BNP'),

    -- Septembre : épargne mensuelle courant → épargne
    (uid, acc_courant, cat_virt, tr_sep_ce, 'transfer_debit',  -20000, '2026-09-02 00:00:00+00', 'Virement mensuel épargne'),
    (uid, acc_epargne, cat_virt, tr_sep_ce, 'transfer_credit',  20000, '2026-09-02 00:00:00+00', 'Virement depuis BNP');

  -- ============================================================
  -- 5. Budgets — mai → sept. 2026
  -- ============================================================
  insert into public.budgets (user_id, category_id, month, amount_cents) values
    (uid, cat_alim,   '2026-05-01', 30000),
    (uid, cat_loge,   '2026-05-01', 90000),
    (uid, cat_trans,  '2026-05-01', 15000),
    (uid, cat_sante,  '2026-05-01', 10000),
    (uid, cat_loisir, '2026-05-01', 8000),
    (uid, cat_resto,  '2026-05-01', 12000),
    (uid, cat_abo,    '2026-05-01', 5000),

    -- Juin 2026
    (uid, cat_alim,     '2026-06-01', 30000),
    (uid, cat_loge,     '2026-06-01', 90000),
    (uid, cat_trans,    '2026-06-01', 15000),
    (uid, cat_loisir,   '2026-06-01', 8000),
    (uid, cat_resto,    '2026-06-01', 12000),
    (uid, cat_abo,      '2026-06-01', 5000),
    (uid, cat_vetement, '2026-06-01', 6000),
    (uid, cat_cadeau,   '2026-06-01', 5000),

    -- Juillet 2026
    (uid, cat_alim,   '2026-07-01', 30000),
    (uid, cat_loge,   '2026-07-01', 90000),
    (uid, cat_trans,  '2026-07-01', 15000),
    (uid, cat_sante,  '2026-07-01', 10000),
    (uid, cat_loisir, '2026-07-01', 8000),
    (uid, cat_resto,  '2026-07-01', 12000),
    (uid, cat_abo,    '2026-07-01', 5000),

    -- Août 2026 — budget voyages volontairement dépassé (63k dépensés / 30k prévus)
    (uid, cat_alim,     '2026-08-01', 30000),
    (uid, cat_loge,     '2026-08-01', 90000),
    (uid, cat_trans,    '2026-08-01', 15000),
    (uid, cat_sante,    '2026-08-01', 10000),
    (uid, cat_loisir,   '2026-08-01', 8000),
    (uid, cat_resto,    '2026-08-01', 12000),
    (uid, cat_abo,      '2026-08-01', 5000),
    (uid, cat_vetement, '2026-08-01', 8000),
    (uid, cat_voyage,   '2026-08-01', 30000),
    (uid, cat_cadeau,   '2026-08-01', 5000),

    -- Septembre 2026 (mois en cours) — budget alimentation volontairement
    -- trop bas pour déclencher l'alerte « budget dépassé » sur le dashboard
    (uid, cat_alim,   '2026-09-01', 5000),
    (uid, cat_loge,   '2026-09-01', 90000),
    (uid, cat_trans,  '2026-09-01', 15000),
    (uid, cat_educ,   '2026-09-01', 10000),
    (uid, cat_resto,  '2026-09-01', 12000),
    (uid, cat_abo,    '2026-09-01', 5000)
  on conflict (user_id, category_id, month) do nothing;

  -- ============================================================
  -- 6. Charges fixes
  -- ============================================================
  insert into public.fixed_charges
    (user_id, name, amount_cents, frequency, next_due_date, account_id, category_id, notes, status)
  values
    (uid, 'Loyer',              85000, 'monthly',   '2026-10-01', acc_courant, cat_loge,   'Virement proprio',        'active'),
    (uid, 'Navigo mensuel',      8400, 'monthly',   '2026-10-04', acc_courant, cat_trans,  'Rechargement station',    'active'),
    (uid, 'Netflix',             1799, 'monthly',   '2026-10-10', acc_courant, cat_abo,    null,                      'active'),
    (uid, 'Spotify',             2999, 'monthly',   '2026-10-16', acc_courant, cat_loisir, null,                      'active'),
    (uid, 'iCloud 50 Go',         999, 'monthly',   '2026-10-22', acc_courant, cat_abo,    null,                      'active'),
    (uid, 'Assurance auto',      9800, 'quarterly', '2026-09-08', acc_courant, cat_banque, 'Prélèvement trimestriel', 'active'),
    (uid, 'Assurance habitation',7200, 'yearly',    '2027-01-15', acc_courant, null,        'Prélevement annuel AXA',  'active'),
    (uid, 'Taxe foncière',      45000, 'yearly',    '2026-10-15', acc_courant, null,        null,                      'active')
  on conflict do nothing;

  -- ============================================================
  -- 7. Objectifs d'épargne
  -- ============================================================
  insert into public.savings_goals
    (user_id, name, target_amount_cents, current_amount_cents, currency, deadline)
  values
    (uid, 'Voyage au Japon',   400000, 165000, 'EUR', '2026-12-31'),
    (uid, 'Fonds d''urgence',  300000, 230000, 'EUR', null),
    (uid, 'Nouvelle voiture', 1500000, 510000, 'EUR', '2028-06-01')
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
