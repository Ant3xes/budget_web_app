# PRD — Application Web "Budget & Comptes"

> **Version** : 1.1 — MVP (mise à jour post-analyse fichiers)
> **Date** : 27 mai 2026
> **Statut** : Draft finalisé
> **Auteur** : Usage personnel + cercle restreint d'amis

---

## Vision

> « Voir d'un coup d'œil l'état de tous mes comptes, comprendre où va mon argent chaque mois, et atteindre mes objectifs d'épargne — le tout en moins de 30 secondes de saisie. »

---

## Utilisateurs cibles

| Persona | Profil | Besoins principaux |
|---------|--------|--------------------|
| **Propriétaire** | 1 utilisateur principal, 6 comptes multi-banques (N26 + BNP) | Vue consolidée, import CSV/XLS, suivi budget complet |
| **Amis invités** | 2–5 utilisateurs, comptes **entièrement séparés** | Accès à leur propre espace, mêmes fonctionnalités |

> ⚠️ **Non-goal** : Pas de dépenses partagées entre utilisateurs. Chaque utilisateur est 100% isolé via RLS Supabase.

---

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

---

## Navigation & Structure

```
├── 🏠 Dashboard         — Vue consolidée de tous les comptes
├── 🏦 Accounts          — Liste et détail des comptes
├── 💸 Expenses          — Dépenses (transactions débit)
├── 💰 Incomes           — Revenus (transactions crédit)
├── 🔁 Transfers         — Virements entre comptes
├── 📊 Budget            — Enveloppes budgétaires mensuelles
├── 🔔 Subscriptions     — Abonnements récurrents
└── 🎯 Goals             — Objectifs d'épargne
```

---

## Features MVP (V1)

### 🏠 Dashboard
- Solde total consolidé (somme de tous les comptes)
- Solde par compte avec variation vs mois précédent
- Dépenses du mois par catégorie (graphique donut — Recharts)
- Revenus vs Dépenses du mois (graphique barre)
- Dernières 10 transactions
- Taux d'utilisation des budgets du mois (barres de progression)
- Alertes : budget dépassé, abonnement à venir dans 7 jours

### 🏦 Accounts
- Liste de tous les comptes avec solde courant
- Détail d'un compte : historique transactions + graphique évolution du solde
- Ajout / modification / archivage d'un compte
- Types : courant, épargne, livret, PEL, autre

### 💸 Expenses
- Liste avec filtres (compte, catégorie, période, montant)
- Ajout manuel (modal rapide)
- Import N26 CSV + BNP XLS
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
- Récurrence : création manuelle au départ, puis option "Recopier le mois précédent"
- Indicateur de consommation temps réel (X € / Y €)
- Navigation mensuelle

### 🔔 Subscriptions
- Liste des abonnements récurrents (nom, montant, fréquence, date prélèvement)
- Total mensuel automatique
- Alerte 7 jours avant chaque prélèvement
- Liaison manuelle à une transaction importée

### 🎯 Goals
- Objectifs indépendants de tout compte (tracker manuel)
- Champs : nom, montant cible, montant actuel, date limite
- Barre de progression + projection date d'atteinte
- Abondement manuel

---

## Catégories

### Dépenses (personnalisables)
`Alimentation` · `Logement` · `Transport` · `Santé` · `Loisirs` · `Abonnements & Téléphonie` · `Shopping` · `Restaurant & Sorties` · `Voyage` · `Éducation` · `Banque & Frais` · `Autre`

### Revenus (personnalisables)
`Salaire` · `Freelance` · `Loyer reçu` · `Virement reçu` · `Remboursement` · `Autre`

---

## Import de données

### Format N26 — CSV

En-têtes : `"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"`

| Colonne N26 | Champ interne | Transformation |
|-------------|---------------|----------------|
| `Booking Date` | `date` | `YYYY-MM-DD` → direct |
| `Partner Name` | `description` | Texte brut |
| `Payment Reference` | `notes` | Texte brut (optionnel) |
| `Amount (EUR)` | `amount_cents` | Float × 100 → INTEGER |
| `Type` | `raw_type` | Pour catégorisation auto |

### Format BNP — XLS

Ligne 1 non standard : `Compte de chèques ****1666 | Solde au JJ/MM/YYYY | montant | EUR`. Vraies colonnes en ligne 2 : `Date operation | Categorie operation | Sous Categorie operation | Libelle operation | Montant | Devise`

| Colonne BNP | Champ interne | Transformation |
|-------------|---------------|----------------|
| `Date operation` | `date` | `DD-MM-YYYY` → `YYYY-MM-DD` |
| `Libelle operation` | `description` | Texte brut |
| `Montant` | `amount_cents` | Float × 100 → INTEGER |

### Comportement import commun
1. Upload fichier (`.csv` ou `.xls/.xlsx`)
2. Détection auto du format (N26 vs BNP) sur les en-têtes
3. Prévisualisation tableau avec checkbox ligne par ligne
4. Déduplication : hash sur `(date + description + amount_cents)`
5. Catégorisation auto par règles mot-clé
6. Import confirmé → insertion en base

---

## Règles métier clés

- **Montants en centimes** (INTEGER) : `45,30 €` = `4530` — jamais de float
- **Devise par défaut** : `EUR` (ISO 4217)
- **Soft delete** sur toutes les transactions (`deleted_at TIMESTAMPTZ`)
- **Isolation utilisateur** : RLS Supabase — chaque user ne voit que ses propres données
- **Dates en UTC** côté BDD, affichage en `Europe/Paris`
- **Solde courant** = `solde_initial` + Σ transactions non supprimées
- **Transfer** = 1 transaction débit + 1 transaction crédit liées par `transfer_id`

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | Next.js 14+ (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| BDD + Auth | Supabase (PostgreSQL + RLS) |
| Graphiques | Recharts |
| Formulaires | React Hook Form + Zod |
| Import XLS | SheetJS (xlsx) |
| Déploiement | Vercel + Supabase Cloud |
| Tests | Vitest (unit) + Playwright (e2e) |

---

## Schéma BDD (simplifié)

Tables : `profiles`, `accounts`, `categories`, `transactions`, `budgets`, `subscriptions`, `savings_goals`, `csv_import_rules`

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
transfer_id      UUID
raw_import_data  JSONB
is_imported      BOOLEAN DEFAULT FALSE
deleted_at       TIMESTAMPTZ
created_at       TIMESTAMPTZ DEFAULT NOW()
```

---

## Non-goals (V1)

- Open Banking / connexion bancaire directe
- Application mobile native
- Dépenses partagées / split bill
- Comptes multi-utilisateurs partagés
- Export PDF/Excel
- Multi-devises actives
- Notifications email/push
- OCR de reçus

---

## Métriques de succès

| Métrique | Cible V1 |
|----------|----------|
| Saisie manuelle d'une transaction | < 30 secondes |
| Import d'un fichier 100 lignes | < 10 secondes |
| Chargement du Dashboard | < 2 secondes |
| Couverture catégorisation auto | > 70% des transactions importées |
| Onboarding (config des 6 comptes) | < 5 minutes |

---

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
- [ ] Transfers entre comptes

### Phase 3 — Budget & Analytics (Semaines 5–6)
- [ ] Module Budget (enveloppes mensuelles)
- [ ] Dashboard Recharts (donut + barres + progression)
- [ ] Subscriptions

### Phase 4 — Goals & Polish (Semaines 7–8)
- [ ] Savings Goals
- [ ] Règles de catégorisation auto
- [ ] Tests Vitest + Playwright
- [ ] Déploiement Vercel + Supabase Cloud
