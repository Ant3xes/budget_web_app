# PRD — Application Web "Budget & Comptes"

> **Version** : 1.8 — Mode nuit (dark mode)
> **Date** : 28 mai 2026
> **Statut** : Phase 4 en cours
> **Auteur** : Usage personnel + cercle restreint d'amis

***

## Vision

> « Voir d'un coup d'œil l'état de tous mes comptes, comprendre où va mon argent chaque mois, et atteindre mes objectifs d'épargne — le tout en moins de 30 secondes de saisie. »

***

## Utilisateurs cibles

| Persona | Profil | Besoins principaux |
|---------|--------|--------------------|
| **Propriétaire** | 1 utilisateur principal, 6 comptes multi-banques (N26 + BNP) | Vue consolidée, import CSV/XLS, suivi budget complet |
| **Amis invités** | 2–5 utilisateurs, comptes **entièrement séparés** | Accès à leur propre espace, mêmes fonctionnalités |

> ⚠️ **Non-goal** : Pas de dépenses partagées entre utilisateurs. Chaque utilisateur est 100% isolé via RLS Supabase.

***

## Comptes gérés (modulaire)

Architecture modulaire : ajout/suppression de compte sans refactoring.

| Compte | Banque | Type |
|--------|--------|------|
| N26 Perso | N26 | Compte courant |
| N26 Commun | N26 | Compte courant |
| BNP Compte Chèque | BNP | Compte courant |
| BNP Livret A | BNP | Livret épargne |
| BNP Épargne | BNP | Compte épargne |
| BNP PEL | BNP | Plan épargne logement |

***

## Navigation & Structure

```
├── 🏠 Dashboard         — Vue consolidée de tous les comptes
├── 🏦 Accounts          — Liste et détail des comptes
├── 💸 Expenses          — Dépenses (transactions débit)
├── 💰 Incomes           — Revenus (transactions crédit)
├── 🔁 Transfers         — Virements entre comptes
├── 📊 Budget            — Enveloppes budgétaires mensuelles
├── 🔒 Fixed Charges     — Charges fixes récurrentes (loyer, élec, tel…)
├── 🎯 Goals             — Objectifs d'épargne
└── ⚙️ Settings          — Gestion des catégories (et préférences)
```

***

## Features MVP (V1)

### 🏠 Dashboard
- Solde total consolidé (somme de tous les comptes)
- Solde par compte avec variation vs mois précédent
- Dépenses du mois par catégorie (graphique donut — Recharts)
- Revenus vs Dépenses du mois (graphique barre)
- Dernières 10 transactions
- Taux d'utilisation des budgets du mois (barres de progression)
- **Alertes affichées sous forme de banners/bandeaux** en haut de page : budget dépassé, charge fixe à venir dans 7 jours

### 🏦 Accounts
- Liste de tous les comptes avec solde courant
- Détail d'un compte : historique transactions + graphique évolution du solde
- Ajout / modification / archivage d'un compte
- Types : courant, épargne, livret, PEL, autre

### 💸 Expenses
- Liste avec filtres (compte, catégorie, période, montant) + **recherche textuelle** (description/notes)
- **Pagination classique** (pages numérotées)
- Ajout manuel (modal rapide)
- Import N26 CSV + BNP XLS (voir section Import ci-dessous)
- Catégorisation manuelle ou auto (règles mot-clé)
- Soft delete

### 💰 Incomes
- Même structure qu'Expenses pour les crédits (filtres + recherche textuelle + pagination)
- Catégories dédiées : Salaire, Freelance, Loyer reçu, Virement reçu, Autre

### 🔁 Transfers
- Virement entre deux comptes de l'utilisateur
- Crée automatiquement un débit côté source + crédit côté destination (transaction liée)
- Historique des virements

### 📊 Budget
- Création manuelle d'enveloppes par catégorie (ex : Alimentation = 400 €/mois)
- **Récurrence** : création manuelle au départ, puis option "Recopier le mois précédent"
- Indicateur de consommation temps réel (X € / Y €)
- Navigation mensuelle

### 🔒 Fixed Charges (Charges Fixes)
Toutes les sorties d'argent **récurrentes et prévisibles**, quelle que soit leur nature :

**Exemples couverts :**
- Logement : loyer, charges de copropriété
- Énergie & utilities : électricité (EDF), gaz, eau
- Télécom : forfait mobile, box internet (Orange, SFR…)
- Assurances : auto (Allianz), habitation, mutuelle
- Services numériques : Netflix, Spotify, Google One, Notion…
- Autres prélèvements fixes : cotisations, abonnements salle de sport, etc.

**Features :**
- Liste des charges avec : nom, montant, fréquence (`monthly` / `quarterly` / `yearly`), date de prélèvement, compte débité
- Montant mensuel équivalent calculé automatiquement (annuel ÷ 12, trimestriel ÷ 3)
- **Total mensuel des charges fixes** affiché en haut de page
- Alerte 7 jours avant chaque échéance (banner Dashboard)
- **`next_due_date` avancée automatiquement** après chaque échéance (via cron Supabase ou background job) : +1 mois / +3 mois / +12 mois selon la fréquence
- Statut : `active` / `suspended` / `cancelled` (soft delete)

> ⚠️ **Fixed Charges ≠ Transactions** : les charges fixes sont un référentiel indépendant. Aucune liaison avec les transactions importées. La transaction réelle est traitée séparément à l'import.

### 🎯 Goals
- Objectifs **indépendants** de tout compte (tracker manuel)
- Champs : nom, montant cible, montant actuel, date limite
- Barre de progression + projection date d'atteinte
- Abondement manuel

***

## Catégories

### Dépenses (personnalisables — ajout/renommage/icône/couleur)
`Alimentation` · `Logement` · `Transport` · `Santé` · `Loisirs` · `Télécom & Internet` · `Shopping` · `Restaurant & Sorties` · `Voyage` · `Éducation` · `Banque & Frais` · `Charges Fixes` · `Autre`

### Revenus (personnalisables)
`Salaire` · `Freelance` · `Loyer reçu` · `Virement reçu` · `Remboursement` · `Autre`

> Les catégories sont personnalisables (ajout, renommage, icône, couleur) depuis la page **Settings**. La navigation et les menus ne sont pas personnalisables.

### ⚙️ Settings — Gestion des catégories
- Liste des catégories par type (`expense` / `income`)
- Ajout / renommage / suppression (soft delete)
- Champ `icon` (emoji) + champ `color` (hex ou Tailwind)
- Catégories par défaut pré-créées au signup

***

## Modèle de données — Table `fixed_charges`

```sql
id               UUID PRIMARY KEY
user_id          UUID REFERENCES auth.users
name             TEXT NOT NULL            -- ex: "Loyer", "Orange Box", "Netflix"
amount_cents     INTEGER NOT NULL         -- montant en centimes
currency         CHAR(3) DEFAULT 'EUR'
frequency        TEXT NOT NULL            -- 'monthly' | 'quarterly' | 'yearly'
next_due_date    DATE NOT NULL            -- prochaine échéance
account_id       UUID REFERENCES accounts -- compte débité
category_id      UUID REFERENCES categories
notes            TEXT
status           TEXT DEFAULT 'active'    -- 'active' | 'suspended' | 'cancelled'
created_at       TIMESTAMPTZ DEFAULT NOW()
deleted_at       TIMESTAMPTZ              -- soft delete
```

> **Calcul montant mensuel équivalent** :
> - `monthly` → `amount_cents`
> - `quarterly` → `amount_cents / 3`
> - `yearly` → `amount_cents / 12`

***

## Import de données

### Format N26 — CSV

**En-têtes réelles** :
```
"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"
```

**Mapping vers le modèle interne :**

| Colonne N26 | Champ interne | Transformation |
|-------------|---------------|----------------|
| `Booking Date` | `date` | Format `YYYY-MM-DD` → direct |
| `Partner Name` | `description` | Texte brut |
| `Payment Reference` | `notes` | Texte brut (optionnel) |
| `Amount (EUR)` | `amount_cents` | Float × 100 → INTEGER, signe conservé |
| `Type` | `raw_type` | Pour règles de catégorisation auto |
| `Account Name` | Détection du compte source | Matching sur nom du compte |

**Types N26 observés :**
- `Presentment` → Paiement carte (généralement dépense)
- `Credit Transfer` → Virement reçu
- `Debit Transfer` → Virement émis
- `MoneyBeam` → P2P N26

***

### Format BNP — XLS (Excel)

**Structure réelle :**
> Ligne 1 non standard : `Compte de chèques ****1666 | Solde au 26/05/2026 | 2194.83 | EUR`. Vraies colonnes à partir de la ligne 2.

**En-têtes réelles (ligne 2) :**
```
Date operation | Categorie operation | Sous Categorie operation | Libelle operation | [Montant] | [Devise]
```

**Mapping vers le modèle interne :**

| Colonne BNP | Champ interne | Transformation |
|-------------|---------------|----------------|
| `Date operation` | `date` | Format `DD-MM-YYYY` → `YYYY-MM-DD` |
| `Libelle operation` | `description` | Texte brut |
| `Categorie operation` | `raw_category` | Suggestion catégorie auto |
| `Sous Categorie operation` | `raw_subcategory` | Enrichissement description |
| `Montant` | `amount_cents` | Float × 100 → INTEGER, signe conservé |

**Catégories BNP → mapping auto :**

| Catégorie BNP | → Catégorie interne |
|---------------|----------------------|
| `Vie Quotidienne / Achats, shopping` | Shopping |
| `Logement / Loyer` | Logement |
| `Transports et Véhicules / Assurance véhicule` | Transport |
| `Abonnements et Telephonie / Internet, TV` | Télécom & Internet |
| `Banque / Épargne` | (Transfer interne — ne pas catégoriser) |
| `Banque / Frais bancaires` | Banque & Frais |
| `Revenus / Loyers` | Loyer reçu |
| `Revenus / Virement reçu` | Virement reçu |
| `Loisirs et Sorties` | Loisirs |
| `À catégoriser` | → Marquer "À catégoriser" dans l'app |

***

### Comportement de l'import (commun N26 + BNP)

1. Upload fichier (`.csv` ou `.xls/.xlsx`)
2. Détection automatique du format basée sur les en-têtes
3. Parsing et prévisualisation dans un tableau (checkbox par ligne)
4. **Déduplication** : hash sur `(date + description + amount_cents)` — doublon **grisé et décoché par défaut**, mais sélectionnable manuellement (fond ambré) pour import forcé
5. **Doublons intra-fichier** : deux occurrences identiques dans le même fichier → la 2ème est marquée doublon (via `seenInFile` côté serveur)
6. **Architecture `rowId`** : chaque ligne reçoit un identifiant unique (`e_0`, `e_1`… / `i_0`, `i_1`…) indépendant du hash — évite tout couplage d'état entre doublons
7. **Catégorisation auto** : règles mot-clé configurables (ex : `ORANGE` → Télécom & Internet)
8. Import confirmé → transactions insérées en base

> **BNP spécifique** : La ligne 1 du fichier contient le solde du compte (`Solde au DD/MM/YYYY | X.XX | EUR`). Cette ligne est **ignorée** lors de l'import — le solde initial du compte est géré manuellement dans l'app.

***

## Règles métier clés

- **Montants en centimes** (INTEGER) : `45,30 €` = `4530` — jamais de float
- **Devise par défaut** : `EUR` (ISO 4217)
- **Soft delete** sur toutes les transactions et charges fixes (`deleted_at TIMESTAMPTZ`)
- **Isolation utilisateur** : RLS Supabase — chaque user ne voit que ses propres données
- **Dates en UTC** côté BDD, affichage en `Europe/Paris`
- **Solde courant** = `solde_initial` + Σ transactions non supprimées
- **Transfer** = 1 transaction débit + 1 transaction crédit liées par `transfer_id`
- **Fixed Charges** ne sont pas des transactions — elles modélisent un engagement récurrent, la transaction réelle est importée séparément

***

## Stack technique

| Couche | Technologie | Justification |
|--------|-------------|---------------|
| Frontend | Next.js 14+ (App Router) + TypeScript | SSR, routing, performance |
| Styling | Tailwind CSS v4 | Rapidité UI, système de design |
| BDD + Auth | Supabase (PostgreSQL + RLS) | Multi-users, gratuit, temps réel |
| Graphiques | Recharts | Léger, React-natif, composable |
| Formulaires | React Hook Form + Zod | Validation robuste, DX excellente |
| Import XLS | `xlsx` (SheetJS) | Parsing côté client, gratuit |
| Déploiement | Vercel + Supabase Cloud | Tier gratuit suffisant, CI/CD |
| Tests | Vitest (unit) + Playwright (e2e) | Flows critiques couverts |

***

## Schéma BDD (simplifié)

```
profiles ──< accounts ──< transactions >── categories
                    \──< budgets >── categories
                    \──< savings_goals
                    \──< csv_import_rules >── categories
profiles ──< fixed_charges >── categories  (référentiel indépendant)
```

### Tables principales

| Table | Rôle |
|-------|------|
| `profiles` | Extension de `auth.users` |
| `accounts` | Comptes bancaires (modulaires) |
| `categories` | Catégories dépenses + revenus (par user) |
| `transactions` | Tous les mouvements, signe `+/-` dans `amount_cents` |
| `budgets` | Enveloppes mensuelles par catégorie |
| `fixed_charges` | Charges fixes récurrentes (loyer, élec, tel, assurances…) |
| `savings_goals` | Objectifs d'épargne (indépendants des comptes) |
| `csv_import_rules` | Règles de catégorisation auto (mot-clé → catégorie) |

### Champs clés — `transactions`

```sql
id               UUID PRIMARY KEY
user_id          UUID REFERENCES auth.users
account_id       UUID REFERENCES accounts
category_id      UUID REFERENCES categories (nullable)
amount_cents     INTEGER  -- positif = crédit, négatif = débit
currency         CHAR(3) DEFAULT 'EUR'
date             DATE
description      TEXT
notes            TEXT
type             TEXT  -- 'expense' | 'income' | 'transfer'
transfer_id      UUID  -- lie deux transactions d'un virement
raw_import_data  JSONB -- données brutes du CSV/XLS original
is_imported      BOOLEAN DEFAULT FALSE
deleted_at       TIMESTAMPTZ
created_at       TIMESTAMPTZ DEFAULT NOW()
```

> ⚠️ **`kind` vs `type`** : en base de données, le champ est nommé `kind` (pour éviter un conflit avec le mot réservé SQL `type`). Les valeurs sont `'expense'`, `'income'`, `'transfer_debit'`, `'transfer_credit'`. `transfer_debit` et `transfer_credit` remplacent un simple `'transfer'` pour distinguer les deux côtés du virement.

### Champs clés — `categories`

```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES profiles
name        TEXT NOT NULL
kind        TEXT  -- 'expense' | 'income' | 'transfer'
color       TEXT  -- code hex ou classe Tailwind
icon        TEXT  -- emoji ou nom d'icône (ex: '🛒', 'home')
deleted_at  TIMESTAMPTZ
created_at  TIMESTAMPTZ DEFAULT NOW()
```

> La colonne `icon` doit être ajoutée par migration (absente de la migration initiale).
| Hors scope | Raison |
|------------|--------|
| Open Banking / connexion bancaire directe | Complexité réglementaire |
| Application mobile native | App web responsive suffit |
| Dépenses partagées / split bill | Non demandé |
| Comptes multi-utilisateurs partagés | Option future, hors scope V1 |
| Export PDF/Excel | V2 |
| Multi-devises actives | Stockage EUR uniquement |
| Notifications email/push | V2 |
| OCR de reçus | V2 |

***

## Métriques de succès

| Métrique | Cible V1 |
|----------|----------|
| Saisie manuelle d'une transaction | < 30 secondes |
| Import d'un fichier 100 lignes | < 10 secondes |
| Chargement du Dashboard | < 2 secondes |
| Couverture catégorisation auto | > 70% des transactions importées |
| Onboarding (config des 6 comptes) | < 5 minutes |

***

## Phases de développement

### Phase 1 — Fondations ✅ (Semaines 1–2)
- [x] Setup Next.js 14 + Supabase + Tailwind
- [x] Auth email/password + système d'invitation
- [x] Schéma BDD complet + migrations + politiques RLS
- [x] CRUD Accounts
- [x] Layout + Sidebar navigation

### Phase 2 — Core Transactions ✅ (Semaines 3–4)
- [x] CRUD Expenses + Incomes (modal + filtres + pagination)
- [x] Catégorisation manuelle (17 catégories par défaut créées au signup)
- [x] Import N26 CSV (wizard 3 étapes : upload → prévisualisation → confirmation)
- [x] Import BNP XLS (SheetJS, gestion ligne d'en-tête non standard)
- [x] Transfers entre comptes (transaction liée débit/crédit + `transfer_id`)
- [x] Règles d'import par mots-clés (`csv_import_rules`)
- [x] **[Amélioration Phase 4]** Sélection manuelle des doublons (fond ambré, décoché par défaut)
- [x] **[Amélioration Phase 4]** Architecture `rowId` — découplage des maps d'état par rapport au hash
- [x] **[Amélioration Phase 4]** Déduplication intra-fichier côté serveur (`seenInFile`)
- [x] **[Amélioration Phase 4]** Reconnaissance auto par historique (`buildHistoryMatcher`) — fallback sur les transactions déjà catégorisées quand aucune règle ne correspond ; `suggestion_source: 'rule' | 'history' | null` dans le preview
- [x] **[Amélioration Phase 4]** Catégorisation rétroactive — bouton "Catégoriser" dans la liste des transactions, preview groupé par catégorie, `POST /api/transactions/apply-rules` (max 500, Zod, RLS)
- [x] **[Amélioration Phase 4]** Import depuis la page Comptes — bouton global sur `/accounts`, `ImportModal` avec `kind` optionnel déclenchant un flow en 2 étapes (dépenses → revenus, 1 seul appel `POST /api/import/confirm`). Rétrocompat totale du flow single-kind depuis `/expenses` et `/incomes`.

### Phase 3 — Budget & Analytics ✅ (Semaines 5–6)
- [x] Module Budget (enveloppes mensuelles + barre de progression colorée + recopie mois précédent)
- [x] Dashboard Recharts (donut dépenses, barres revenus/dépenses 6 mois, barres budget)
- [x] Fixed Charges (CRUD + alertes + `advanceDueDate` auto au GET)
- [x] Savings Goals (tracker indépendant : montant cible, montant actuel, abondement manuel)
- [x] Correction bug solde Dashboard (prise en compte `initial_balance_cents` par compte)

### Phase 4 — Finition 🚧 (Semaines 7–8)
- [x] Tests Vitest (unit/integration) + Playwright (E2E) — 87 tests au total :
  - `unit/apply-rules.test.ts` (24 tests) : `detectTransfer`, `buildDefaultMatcher`, `buildHistoryMatcher`, `buildRuleMatcher`
  - `unit/deduplicate.test.ts` (9 tests) : `buildHash`, `findExistingHashes`
  - `unit/detect-format.test.ts` (4 tests), `unit/parse-n26.test.ts` (10 tests), `unit/parse-bnp.test.ts` (8 tests)
  - `api/import-preview.test.ts` (13 tests) : auth, validations, preview shape, doublons, transfers, catégorisation
  - `api/import-confirm.test.ts` (14 tests) : auth, Zod, expense/income/transfer ±contrepartie, erreur DB
  - `api/savings-goals.test.ts` (5 tests)
  - E2E : 4 tests import dans `e2e/features.spec.ts`
- [x] **Mode nuit (dark mode)** : `ThemeProvider` + toggle soleil/lune dans le header, script anti-FOUC, `color-scheme: dark` sur les date inputs, variantes `dark:` sur 35+ composants/pages, Recharts avec couleurs dynamiques via `useTheme()`, pages login/signup incluses (issue #11)
- [ ] Profil utilisateur : modification nom d'affichage + changement de mot de passe (`/settings/profile`)
- [ ] Détail de compte : `/accounts/[id]` → historique transactions filtrables + graphique Recharts évolution du solde
- [ ] Page roadmap `/plan` : accessible sans auth, statique, résumé phases + décisions d'archi
- [ ] Déploiement Vercel + Supabase Cloud (secrets GitHub CI/CD à configurer)
