# PRD — Application Web "Budget & Comptes"

> **Version** : 1.3 — Simplification Fixed Charges (liaison supprimée)
> **Date** : 27 mai 2026
> **Statut** : Draft finalisé
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
└── 🎯 Goals             — Objectifs d'épargne
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
- Alertes : budget dépassé, charge fixe à venir dans 7 jours

### 🏦 Accounts
- Liste de tous les comptes avec solde courant
- Détail d'un compte : historique transactions + graphique évolution du solde
- Ajout / modification / archivage d'un compte
- Types : courant, épargne, livret, PEL, autre

### 💸 Expenses
- Liste avec filtres (compte, catégorie, période, montant)
- Ajout manuel (modal rapide)
- Import N26 CSV + BNP XLS (voir section Import ci-dessous)
- Catégorisation manuelle ou auto (règles mot-clé)
- Soft delete

### 💰 Incomes
- Même structure qu'Expenses pour les crédits
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
- Liste des charges avec : nom, montant, fréquence (`mensuel` / `trimestriel` / `annuel`), date de prélèvement, compte débité
- Montant mensuel équivalent calculé automatiquement (annuel ÷ 12, trimestriel ÷ 3)
- **Total mensuel des charges fixes** affiché en haut de page
- Alerte 7 jours avant chaque échéance
- Liaison manuelle à une transaction importée (matching automatique suggéré par mot-clé)
- Statut : `actif` / `suspendu` / `résilié` (soft delete)

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

> Les catégories sont personnalisables (ajout, renommage, icône, couleur) mais **pas la navigation ni les menus**.

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
4. **Déduplication** : hash sur `(date + description + amount_cents)` — doublon ignoré avec warning
5. **Catégorisation auto** : règles mot-clé configurables (ex : `ORANGE` → Télécom & Internet)
6. Import confirmé → transactions insérées en base

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

***

## Non-goals (V1)

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

### Phase 1 — Fondations (Semaines 1–2)
- [ ] Setup Next.js 14 + Supabase + Tailwind
- [ ] Auth email/password + système d'invitation
- [ ] Schéma BDD complet + migrations + politiques RLS
- [ ] CRUD Accounts
- [ ] Layout + Sidebar navigation

### Phase 2 — Core Transactions (Semaines 3–4)
- [ ] CRUD Expenses + Incomes
- [ ] Catégorisation manuelle
- [ ] Import N26 CSV
- [ ] Import BNP XLS (SheetJS, gestion ligne d'en-tête non standard)
- [ ] Transfers entre comptes (transaction liée)

### Phase 3 — Budget & Analytics (Semaines 5–6)
- [ ] Module Budget (enveloppes mensuelles manuelles + recopie)
- [ ] Dashboard Recharts (donut + barres + progression)
- [ ] Fixed Charges (CRUD + alertes + liaison transactions)

### Phase 4 — Goals & Polish (Semaines 7–8)
- [ ] Savings Goals (tracker indépendant)
- [ ] Règles de catégorisation auto (CSV import rules)
- [ ] Tests Vitest + Playwright
- [ ] Déploiement Vercel + Supabase Cloud
