# À confirmer / modifier — UX Comptes (détail)

> **Lié à** : [`prd-accounts-detail.md`](./prd-accounts-detail.md)  
> **Objectif** : lister ce qui n'est **pas encore tranché**, ce qui **diverge** des PRDs existants, et ce qu'il faut **corriger** avant de considérer le travail prêt à commit / agent.

---

## Légende

| Tag | Signification |
|-----|----------------|
| 🔴 Bloquant | Cassé ou incohérent — à trancher avant merge |
| 🟡 Décision produit | Choix UX / scope à confirmer |
| 🟠 Alignement PRD | Écart vs `prd-phase4.md` / `PRD.md` |
| 🟢 Finitions | Nice-to-have / polish |

---

## 1. Câblage incomplet

| # | Tag | Point | État actuel | Question |
|---|-----|-------|-------------|----------|
| 1.1 | 🔴 | Route `/accounts/[id]` | Affiche encore `AccountForm` (mode édition) | Brancher `AccountDetail` + calcul `chartData` côté serveur ? |
| 1.2 | 🔴 | Données chart | `AccountDetail` attend `chartData` mais aucune page ne le calcule | Où calculer la série (Server Component page vs API dédiée) ? Fenêtre max (24 mois / depuis création) ? |
| 1.3 | 🔴 | Transactions initiales SSR | Props `initialTransactions` / `initialMonth` non branchées | Charger le mois courant (ou `?month=`) en SSR puis hydrater le client ? |

---

## 2. Écarts vs `prd-phase4.md` (module Détail compte)

| # | Tag | PRD Phase 4 | WIP actuel | À confirmer |
|---|-----|-------------|------------|-------------|
| 2.1 | 🟠 | Édition sur `/accounts/[id]/edit` | Édition en **modal** depuis le détail | Garder la modal (plus fluide) et abandonner `/edit` ? Ou ajouter `/edit` en plus ? |
| 2.2 | 🟠 | Graphique « 6 derniers mois » fixes | Sélecteur **3m / 6m / 1a / 2a / tout** | Valider les plages ; défaut = 6m OK ? |
| 2.3 | 🟠 | Une liste transactions filtrable | **Trois** listes (Dépenses \| Revenus \| Virements) | Valider ce découpage vs une seule liste + filtres |
| 2.4 | 🟠 | Pagination 25/page | `per_page=100`, pas de pages | Suffisant en V1 ou pagination classique ? |
| 2.5 | 🟡 | Lien « Edit » sur la liste | Cards cliquables = détail uniquement ; plus de delete sur la liste | Suppression uniquement depuis le détail : OK ? |

---

## 3. Import modal — régression probable (hors scope produit sauf confirmation)

Le diff modifie fortement `ImportModal` **en même temps** que l'UX comptes. Impact :

| # | Tag | Point | Détail |
|---|-----|-------|--------|
| 3.1 | 🔴 | `kind` devenu **obligatoire** | `AccountsImportButton` n'envoie plus `kind` → TypeScript / runtime cassé pour l'import depuis Comptes |
| 3.2 | 🔴 | Flow 2 étapes dépenses→revenus retiré | Contredit `PRD.md` (amélioration Phase 4 cochée) et issues #8–#10 / commit `e027fc8` |
| 3.3 | 🔴 | UI virements + `rowId` retirés | Perte de sélection manuelle doublons découplée, marquage virement, etc. |
| 3.4 | 🟡 | Intention | Est-ce un **rollback volontaire**, un **essai local**, ou un **accident de rebase/WIP** ? |

**Recommandation par défaut** (à confirmer) : **exclure** tout le diff `import-modal.tsx` de cette PRD / de ce commit ; restaurer la version `e027fc8` ; ne traiter l'import que dans une PRD dédiée.

---

## 4. API `GET /api/transactions`

| # | Tag | Point | Question |
|---|-----|-------|----------|
| 4.1 | 🟡 | Défaut sans `kind` | Inclure les 4 kinds change le comportement pour **tous** les consommateurs qui n'envoyaient pas `kind`. Vérifier `/expenses`, `/incomes`, listes, tests. |
| 4.2 | 🟢 | Alternative | Forcer `kind` explicite côté détail (plusieurs appels ou `kind` répété) pour ne pas élargir le défaut global |

---

## 5. UX / copy / i18n

| # | Tag | Point | Question |
|---|-----|-------|----------|
| 5.1 | 🟡 | Langue | Liste/détail en français ; ancienne page « Edit account » encore en anglais | Uniformiser FR partout ? |
| 5.2 | 🟢 | Solde affiché sur le détail | Header montre nom + type, **pas** le solde courant | Afficher le solde en grand sous le titre ? |
| 5.3 | 🟢 | Empty states | Messages déjà FR | OK tels quels ? |
| 5.4 | 🟢 | Menu `⋮` | Accessible (`aria-label`) | OK ; vérifier clavier / focus trap modal |

---

## 6. Données & règles métier

| # | Tag | Point | Question |
|---|-----|-------|----------|
| 6.1 | 🟡 | Dépenses du mois (card) | Uniquement `kind === "expense"` ; ignore `transfer_debit` | Les sorties de virement doivent-elles compter dans « Dépenses ce mois » ? |
| 6.2 | 🟡 | Calcul chart | Non implémenté : convention à figer = solde en fin de chaque mois = `initial + SUM(tx date <= fin mois)` | Confirmer |
| 6.3 | 🟡 | Soft delete | Liste ignore `deleted_at` ; API détail aussi | OK |
| 6.4 | 🟢 | Devise | Chart tooltip formaté en EUR en dur | Utiliser `account.currency` |

---

## 7. Fichiers & commit

| # | Tag | Point | Action proposée |
|---|-----|-------|-----------------|
| 7.1 | 🔴 | `supabase/.temp/cli-latest` | Ne pas committer |
| 7.2 | 🟡 | Découpage commits | 1) UX comptes (liste + détail + API) 2) import (si gardé) séparé |
| 7.3 | 🟢 | Issue GitHub | Publier `prd-accounts-detail.md` en issue + lier ce fichier en commentaire ? |

---

## 8. Tests

| # | Tag | Point | Question |
|---|-----|-------|----------|
| 8.1 | 🟡 | Vitest API kinds | Tester le nouveau défaut + filtre `account_id` + période |
| 8.2 | 🟡 | E2E détail | Après câblage route : clic card → graphique + listes + mois |
| 8.3 | 🟢 | Extraction pure | Extraire `computeBalanceSeries(transactions, initial)` testable sans React |

---

## Décisions à prendre en priorité (ordre suggéré)

1. **Import modal** : rollback vs inclusion volontaire (3.x)
2. **Brancher** `/accounts/[id]` sur `AccountDetail` + définir calcul `chartData` (1.x)
3. **Modal vs `/edit`** (2.1)
4. **Élargissement défaut API transactions** (4.1)
5. **« Dépenses ce mois »** inclut-il les virements sortants ? (6.1)

---

## Journal

| Date | Note |
|------|------|
| 2026-07-19 | Création à partir du working tree non commité (analyse agent). Aucune décision produit encore tranchée ici. |
