## Problem Statement

L'application Budget & Comptes dispose d'une gestion des transactions (dépenses, revenus, virements) et d'un import CSV/XLS fonctionnel. Cependant, trois fonctionnalités fondamentales pour le pilotage budgétaire sont manquantes :

1. **Pas de module Budget** : la table `budgets` existe en base mais aucune interface ne permet de créer des enveloppes mensuelles par catégorie ni de suivre leur consommation réelle.
2. **Pas de gestion des charges fixes** : la table `fixed_charges` (loyer, abonnements, assurances…) existe mais n'a aucune interface, aucune logique d'avancement de date d'échéance, et aucune alerte.
3. **Dashboard rudimentaire** : le tableau de bord affiche un solde consolidé incorrect (ne prend pas en compte le solde initial par compte) et ne propose aucune visualisation graphique des données.

---

## Solution

Implémenter trois modules complémentaires formant la Phase 3 :

1. **Module Budget** : page `/budget` avec navigation mensuelle, tableau des enveloppes par catégorie, barres de progression colorées, et option de recopie du mois précédent.
2. **Module Charges fixes** : page `/fixed-charges` avec CRUD complet, gestion des statuts, avancement automatique de `next_due_date`, montant mensuel équivalent, et alertes d'échéance.
3. **Dashboard analytique** : refonte complète de `/dashboard` avec correction du bug de solde, graphique donut (dépenses par catégorie), graphique barres (revenus vs dépenses sur 6 mois), barres de progression budget, et banners d'alerte contextuels.

---

## User Stories

1. En tant qu'utilisateur, je veux créer une enveloppe budgétaire (catégorie + montant) pour un mois donné, afin de me fixer des limites de dépenses par poste.
2. En tant qu'utilisateur, je veux voir le montant consommé vs l'enveloppe pour chaque catégorie, afin de savoir où j'en suis en temps réel.
3. En tant qu'utilisateur, je veux une barre de progression colorée (vert < 80%, orange 80–100%, rouge > 100%) par enveloppe, afin d'identifier visuellement les dépassements.
4. En tant qu'utilisateur, je veux naviguer entre les mois (← →) sur la page Budget via des boutons, afin de consulter les mois passés ou planifier les mois futurs.
5. En tant qu'utilisateur, je veux que le mois actif soit reflété dans l'URL (`?month=YYYY-MM`), afin de pouvoir partager un lien ou recharger la page sans perdre le contexte.
6. En tant qu'utilisateur, je veux un bouton « Recopier depuis le mois précédent » quand le mois courant n'a aucune enveloppe, afin de gagner du temps sur la configuration mensuelle.
7. En tant qu'utilisateur, je veux modifier le montant d'une enveloppe existante, afin de l'ajuster en cours de mois.
8. En tant qu'utilisateur, je veux supprimer une enveloppe budgétaire (soft delete), afin de corriger une erreur de saisie.
9. En tant qu'utilisateur, je veux que le système m'indique si j'essaie de créer une enveloppe en doublon (même catégorie, même mois), afin d'éviter les conflits.
10. En tant qu'utilisateur, je veux voir le récapitulatif du mois (budget total, montant consommé, montant restant) en haut de la page Budget.
11. En tant qu'utilisateur, je veux créer une charge fixe avec un nom, un montant, une fréquence (mensuelle/trimestrielle/annuelle), une date de prochaine échéance, un compte débité et une catégorie optionnelle, afin de centraliser mes prélèvements récurrents.
12. En tant qu'utilisateur, je veux que la date de prochaine échéance d'une charge fixe avance automatiquement une fois la date passée, afin de ne pas avoir à la mettre à jour manuellement.
13. En tant qu'utilisateur, je veux voir le montant mensuel équivalent pour les charges trimestrielles et annuelles (ex : 450€/an → 37,50€/mois), afin de comparer les charges sur la même base.
14. En tant qu'utilisateur, je veux voir le total mensuel de toutes mes charges actives en haut de la page, afin d'avoir une vision consolidée de mes engagements.
15. En tant qu'utilisateur, je veux suspendre une charge fixe temporairement (ex : abonnement en pause), afin qu'elle n'entre plus dans les calculs sans être supprimée.
16. En tant qu'utilisateur, je veux marquer une charge comme annulée, afin de garder une trace historique sans qu'elle apparaisse dans les totaux actifs.
17. En tant qu'utilisateur, je veux voir un badge « ⚠ Bientôt » sur les charges dont l'échéance est dans ≤ 7 jours, afin de ne pas oublier un prélèvement imminent.
18. En tant qu'utilisateur, je veux voir le solde consolidé correct sur le Dashboard, calculé comme la somme de (`initial_balance_cents + SUM(transactions)`) par compte, afin d'avoir une information fiable.
19. En tant qu'utilisateur, je veux voir un graphique donut des dépenses par catégorie pour le mois courant, afin de comprendre d'un coup d'œil où va mon argent.
20. En tant qu'utilisateur, je veux voir un graphique en barres revenus/dépenses sur les 6 derniers mois, afin d'identifier les tendances.
21. En tant qu'utilisateur, je veux voir les barres de progression budget sur le Dashboard (toutes les enveloppes du mois, triées par taux de consommation décroissant), afin d'avoir une vue rapide depuis la page d'accueil.
22. En tant qu'utilisateur, je veux voir un banner d'alerte rouge sur le Dashboard pour chaque charge fixe dont l'échéance est dans ≤ 7 jours, afin d'être alerté sans consulter la page dédiée.
23. En tant qu'utilisateur, je veux voir un banner d'alerte orange pour chaque enveloppe budgétaire dépassée, afin d'être informé des dépassements depuis le tableau de bord.
24. En tant qu'utilisateur, je veux voir les 10 dernières transactions (hors virements internes) sur le Dashboard, avec montant coloré (rouge négatif, vert positif), afin d'avoir un aperçu récent de mon activité.

---

## Implementation Decisions

### APIs REST (pattern établi : GET/POST sur la collection, PATCH/DELETE sur `[id]`)

- **`GET /api/budgets?month=YYYY-MM`** : convertit le mois en plage de dates (`YYYY-MM-01` à `YYYY-(MM+1)-01`), récupère les enveloppes avec `categories(name, color, icon)`, calcule la consommation réelle via une requête `GROUP BY category_id` sur `transactions` (kind=expense, dans la plage de dates, non supprimées). Retourne `{ budgets, consumption }`.
- **`POST /api/budgets`** : Zod schema `{ category_id (uuid), month (/^\d{4}-\d{2}$/), amount_cents (int > 0) }`. Le mois est normalisé en `YYYY-MM-01` avant insertion. Retourne 409 avec message localisé en cas de violation de la contrainte UNIQUE `(user_id, category_id, month)`.
- **`PATCH /api/budgets/[id]`** : seul `amount_cents` est patchable.
- **`DELETE /api/budgets/[id]`** : soft delete (`deleted_at = now()`).
- **`GET /api/fixed-charges`** : avant de retourner les données, détecte les charges `active` avec `next_due_date < today` et avance la date via une boucle TypeScript (fonction `advanceDueDate`) qui ajoute +1/+3/+12 mois selon `frequency` jusqu'à ce que la date soit ≥ aujourd'hui. Effectue un `UPDATE` bulk, puis retourne toutes les charges non supprimées avec `accounts(name)` et `categories(name, color, icon)`.
- **`POST /api/fixed-charges`** : Zod schema `{ name (str 1-100), amount_cents (int > 0), frequency (monthly|quarterly|yearly), next_due_date (/^\d{4}-\d{2}-\d{2}$/), account_id? (uuid|null), category_id? (uuid|null), notes? (str|null), status? default 'active' }`.
- **`PATCH /api/fixed-charges/[id]`** : tous les champs patchables, y compris `status`.
- **`DELETE /api/fixed-charges/[id]`** : soft delete.

### Module Budget — composants client

- **`BudgetList`** (`'use client'`) : reçoit `initialMonth` en prop (YYYY-MM). État interne pour le mois courant, synchronisé avec l'URL via `window.history.replaceState` (sans navigation Next.js). Affiche un tableau trié par taux de consommation décroissant. Barres de progression colorées : vert si < 80%, orange si 80–100%, rouge si > 100%. Bouton « Recopier depuis [mois précédent] » visible uniquement si le tableau est vide : itère sur les enveloppes du mois précédent et appelle `POST /api/budgets` pour chacune.
- **`BudgetModal`** (`'use client'`) : React Hook Form + Zod. Sélecteur de catégorie filtré sur `kind === 'expense'`. Mode création (POST) et édition (PATCH sur `amount_cents` uniquement). Affiche le message d'erreur 409 inline.

### Module Fixed Charges — composants client

- **`FixedChargesList`** (`'use client'`) : tableau avec menu d'actions contextuel (bouton ⋯ avec ref + `useEffect` pour fermeture au clic extérieur). Actions contextuelles selon le statut courant : `active` → Suspendre ; `suspended` → Réactiver ; non-`cancelled` → Marquer annulé ; toujours → Supprimer. La colonne « Éq. mensuel » n'est affichée que si la charge n'est pas mensuelle. La ligne est mise en évidence si `next_due_date ≤ today + 7 jours`. Total mensuel = somme des équivalents mensuels des charges `active` uniquement.
- **`FixedChargesModal`** (`'use client'`) : champs — nom, montant, fréquence (select), date (input date), compte (select optionnel), catégorie (select optionnel, toutes kinds), notes (textarea). Mode création + édition.

### Dashboard — architecture de données

- Page Server Component (`app/(app)/dashboard/page.tsx`) avec 6 requêtes parallèles (`Promise.all`) puis calculs séquentiels.
- **Correction bug solde** : récupère tous les comptes + toutes leurs transactions non supprimées, puis calcule `balance = initial_balance_cents + SUM(amount_cents)` par compte, puis somme tous les comptes.
- Données pour donut : `reduce` sur les transactions du mois courant avec `kind === 'expense'`, groupées par `category_id`. Cast Supabase join : `tx.categories as unknown as { name, color } | null`.
- Données pour bar chart 6 mois : dictionnaire `{ 'YYYY-MM': { income, expense } }` rempli depuis la requête `GROUP BY date_trunc('month', date), kind`.

### Recharts — pattern client

Tous les composants Recharts sont des `'use client'` sub-components recevant des données pré-calculées en props depuis le Server Component parent :
- **`DonutChart`** : `PieChart > Pie (innerRadius=60, outerRadius=100, paddingAngle=2) > Cell`. Tooltip guard : `typeof value === 'number' ? formatEuros(value) : String(value ?? '')`.
- **`BarChart`** : 2 barres (revenus en vert #22c55e, dépenses en rouge #ef4444). Même guard Tooltip.

### Contraintes techniques

- **Next.js 16** : `searchParams` et `params` sont des Promises dans les Server Components et route handlers → toujours `await searchParams` / `await params`.
- **Types Supabase joins** : les colonnes de jointure retournent des tableaux côté TypeScript → cast `as unknown as Type | null` pour éviter TS2352.
- **Montants** : toujours en centimes entiers — les inputs utilisateur (type text, regex `/^\d+([.,]\d{1,2})?$/`) sont convertis avec `Math.round(parseFloat(str.replace(',', '.')) * 100)`.

---

## Testing Decisions

### Critères de bons tests

Tester le comportement observable externe : ce que l'API retourne (status codes, shape des données) et ce que l'utilisateur voit dans le navigateur. Ne pas tester les détails d'implémentation (noms de fonctions internes, état React).

### Modules à tester

**Vitest** :
- `lib/import/apply-rules.ts`, `detect-format.ts`, `parse-n26.ts`, `parse-bnp.ts`, `deduplicate.ts` — déjà couverts (35 tests passants).
- `app/api/budgets/route.ts` : POST avec mois valide → 201 ; POST doublon → 409 avec message ; GET sans month → 400.
- `app/api/fixed-charges/route.ts` : vérifier la logique d'avancement de `next_due_date` (fonction `advanceDueDate` pure, testable en isolation).

**Playwright** :
- Budget : navigation ←→ change le mois dans l'URL ; création d'une enveloppe → apparaît dans le tableau ; tentative de doublon → message d'erreur affiché.
- Fixed Charges : charge avec échéance passée → rechargement → date avancée ; menu ⋯ → Suspendre → badge « Suspendu » visible.
- Dashboard : solde consolidé affiché ; alertes visibles si données présentes.

Prior art : `e2e/auth.spec.ts`, `e2e/features.spec.ts`, `__tests__/mocks/supabase.ts`.

---

## Out of Scope

- Liaison entre charges fixes et transactions (les charges fixes sont un référentiel indépendant — pas de débit automatique sur le compte).
- Budget prévisionnel basé sur les charges fixes.
- Notifications email ou push pour les alertes d'échéance.
- Avancement `next_due_date` via Supabase pg_cron — l'avancement au `GET /api/fixed-charges` est transparent et suffisant en V1.
- Historique des montants d'une enveloppe (une seule valeur courante par mois/catégorie).
- Partage de budget entre utilisateurs (isolation RLS stricte).

---

## Further Notes

- La contrainte UNIQUE `(user_id, category_id, month)` sur la table `budgets` était déjà présente dans la migration `20260527183000_phase1.sql` — aucune migration supplémentaire n'a été nécessaire pour la Phase 3.
- La table `fixed_charges` dispose de tous les champs requis depuis la migration `20260527190000_replace_subscriptions_with_fixed_charges.sql`.
- Le bug de solde du Dashboard (qui sommait toutes les transactions sans tenir compte du solde initial par compte) a été corrigé dans cette phase.