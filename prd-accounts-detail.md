# PRD — UX Comptes : liste cards, détail compte & modal d'édition

> **Statut** : brouillon — photographie de l'état actuel du working tree (non commité)  
> **Date** : 19 juillet 2026  
> **Parent** : Phase 4 Finition (`prd-phase4.md` / issue #3) — module « Détail de compte » uniquement  
> **Fichier compagnon** : [`prd-accounts-detail-a-confirmer.md`](./prd-accounts-detail-a-confirmer.md) — points à confirmer / modifier

---

## Problem Statement

La page Comptes est encore un tableau CRUD (création inline + lien « Edit » vers le formulaire). L'utilisateur ne peut pas consulter d'un coup d'œil le solde et les dépenses du mois, ni ouvrir un vrai détail de compte (historique + évolution du solde). L'édition monopolise `/accounts/[id]`, ce qui empêche la consultation.

---

## Solution (état actuel du code)

Refactor de l'UX Comptes autour de trois surfaces :

1. **Liste** `/accounts` : grille de cards (solde actuel + dépenses du mois), bouton `+` pour créer un compte en modal, clic sur une card pour ouvrir le détail.
2. **Détail** `/accounts/[id]` : vue de consultation (graphique d'évolution du solde, historique mensuel découpé en Dépenses / Revenus / Virements), édition et suppression via menu `⋮` + modal — **sans** route `/edit` dédiée.
3. **API transactions** : le `GET` peut renvoyer aussi les kinds `transfer_debit` et `transfer_credit` pour alimenter le détail compte.

Le working tree contient aussi une **simplification de `ImportModal`** (flow single-`kind` obligatoire, retrait UI virements / `rowId` / flow 2 étapes). Ce changement est **documenté dans le fichier compagnon** : il n'est pas considéré comme faisant partie du scope produit validé de cette PRD tant qu'il n'est pas confirmé.

---

## User Stories

### Liste des comptes

1. En tant qu'utilisateur, je veux voir mes comptes sous forme de cards, afin de lire rapidement le solde de chacun.
2. En tant qu'utilisateur, je veux voir les dépenses du mois en cours sur chaque card, afin de repérer les comptes actifs.
3. En tant qu'utilisateur, je veux cliquer sur une card pour ouvrir le détail du compte, afin d'analyser ses mouvements.
4. En tant qu'utilisateur, je veux créer un compte via un bouton `+` qui ouvre une modal, afin de ne pas encombrer la page liste.
5. En tant qu'utilisateur, je veux un état vide clair avec un CTA « Créer un compte » quand je n'ai aucun compte.
6. En tant qu'utilisateur, je veux conserver le bouton « Importer » sur la page Comptes, afin d'importer depuis cette vue.

### Détail de compte

7. En tant qu'utilisateur, je veux voir le nom et le type du compte en en-tête du détail.
8. En tant qu'utilisateur, je veux un graphique d'évolution du solde (LineChart Recharts), afin de comprendre la tendance.
9. En tant qu'utilisateur, je veux choisir la plage du graphique (3 mois, 6 mois, 1 an, 2 ans, tout), afin d'adapter la vue.
10. En tant qu'utilisateur, je veux naviguer mois par mois (← →) sur l'historique, afin de ne pas être noyé dans toutes les opérations.
11. En tant qu'utilisateur, je veux que l'URL reflète le mois sélectionné (`?month=YYYY-MM`), afin de pouvoir partager / recharger la vue.
12. En tant qu'utilisateur, je veux voir les dépenses et les revenus du mois côte à côte.
13. En tant qu'utilisateur, je veux voir les virements du mois (entrants / sortants) dans une section dédiée.
14. En tant qu'utilisateur, je veux ouvrir un menu `⋮` pour éditer ou supprimer le compte depuis le détail.
15. En tant qu'utilisateur, je veux éditer le compte dans une modal sans quitter la page détail.
16. En tant qu'utilisateur, je veux confirmer avant suppression, puis être renvoyé vers `/accounts`.

### API / données

17. En tant que client du détail compte, je veux récupérer via `GET /api/transactions` les dépenses, revenus **et** virements d'un compte pour une période, afin d'afficher les trois listes.
18. En tant que page liste, je veux calculer le solde comme `initial_balance_cents + SUM(transactions non soft-deleted)`, cohérent avec le reste de l'app.

---

## Implementation Decisions (tel que codé aujourd'hui)

### Module A — Liste des comptes (`AccountsList`)

- Server Component `/accounts` charge les comptes + transactions (`amount_cents`, `deleted_at`, `kind`, `date`).
- Agrégation côté serveur : `balanceCents`, `monthExpenseCents` (kind `expense` dans le mois calendaire courant).
- Client Component `AccountsList` : grille responsive (1 / 2 / 3 colonnes), cards cliquables vers `/accounts/[id]`.
- Création : modal `AccountModal` sans `accountId`.

### Module B — Détail de compte (`AccountDetail` + `BalanceChart`)

- Composants présents : `account-detail.tsx`, `balance-chart.tsx`.
- Props attendues : compte, transactions initiales du mois, mois initial (`YYYY-MM`), série `chartData` (label mois + solde en centimes).
- Navigation mois : `useState` + `window.history.replaceState` + refetch `GET /api/transactions?account_id&date_from&date_to&per_page=100`.
- Split UI : 3 tables (expenses / incomes / transfers).
- Plages chart client-side : slice de `chartData` selon 3m / 6m / 1a / 2a / tout.
- Dark mode : `BalanceChart` utilise `useTheme()` pour couleurs Recharts.
- **Écart vs `prd-phase4.md`** : pas de route `/accounts/[id]/edit` — édition en modal.

### Module C — Modal compte (`AccountModal` + `AccountForm`)

- Overlay réutilisable création / édition.
- `AccountForm` accepte `onSuccess` optionnel : si fourni → callback + `router.refresh()` ; sinon → redirect `/accounts` (comportement legacy).

### Module D — API transactions

- Query Zod `kind` : `expense | income | transfer_debit | transfer_credit` (optionnel).
- Sans `kind` : filtre par défaut sur les **4** kinds (plus seulement expense/income).

### Câblage route détail

- `app/(app)/accounts/[id]/page.tsx` affiche encore le **formulaire d'édition** seul.
- `AccountDetail` / `BalanceChart` / `AccountModal` existent mais **ne sont pas encore branchés** sur cette route.

### Hors scope produit de cette PRD (présent dans le diff)

- Modifications de `ImportModal` (simplification) — voir fichier compagnon.
- Fichier `supabase/.temp/cli-latest` (bruit d'outil, à ne pas committer).

---

## Testing Decisions

### Ce qui fait un bon test

Tester le comportement observable (UI E2E ou contrat API), pas les détails internes React.

### Couverture prévue (non encore écrite pour ce WIP)

| Zone | Type | Intention |
|------|------|-----------|
| `GET /api/transactions` sans `kind` | Vitest | Retourne aussi les virements |
| Liste `/accounts` | Playwright | Cards visibles, clic → détail |
| Détail compte | Playwright | Graphique + listes + changement de mois |
| Modal création | Playwright | `+` → create → card apparaît |

### Prior art

- `__tests__/api/savings-goals.test.ts`, mocks Supabase
- `e2e/features.spec.ts` (helper `login`)
- Pattern mois : `BudgetList` (`replaceState`)

---

## Out of Scope

- Profil utilisateur (`/settings/profile`)
- Page roadmap `/plan`
- Open Banking / sync bancaire
- Pagination au-delà de `per_page=100` sur le détail
- Édition inline des transactions depuis le détail
- Export PDF / CSV du détail compte
- Déploiement Vercel / secrets CI

---

## Further Notes

- Cette PRD photographie le **working tree** au 19/07/2026 ; elle n'est pas encore issue GitHub `ready-for-agent`.
- Elle affine / remplace partiellement le module 2 de `prd-phase4.md` (détail compte), sans toucher profil ni `/plan`.
- Les écarts, régressions potentielles et décisions ouvertes sont listés dans [`prd-accounts-detail-a-confirmer.md`](./prd-accounts-detail-a-confirmer.md).
- Règles métier inchangées : montants en centimes, soft delete, RLS, isolation utilisateur.
