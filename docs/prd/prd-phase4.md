# PRD — Phase 4 Finition : Profil utilisateur, Détail compte & Page roadmap consultable

> **Label** : `ready-for-agent`  
> **Repo** : github.com/Ant3xes/budget_web_app  
> **Publier** : `gh issue create --title "PRD — Phase 4 Finition : Profil utilisateur, Détail compte & Page roadmap consultable" --label "ready-for-agent" --body-file /tmp/prd-phase4-finition.md`

---

## Problem Statement

L'application Budget & Comptes est fonctionnelle sur les modules principaux (comptes, transactions, import, budget, charges fixes, objectifs, règles d'import). Trois lacunes bloquent la mise en production et la clôture de la Phase 4 :

1. **La page Profil** affiche un message « Disponible en phase 4 » — l'utilisateur ne peut pas modifier son nom d'affichage ni changer son mot de passe depuis l'interface.
2. **La page `/accounts/[id]`** ouvre directement le formulaire d'édition, sans permettre de consulter l'historique des transactions du compte ni de visualiser l'évolution du solde — information pourtant critique pour un outil de suivi budgétaire.
3. **Il n'existe aucun document consultable** (page dans l'app ou export) qui résume l'état d'avancement du projet, les décisions prises, et le travail restant — ce qui rend le suivi difficile pour le propriétaire et les agents qui reprennent le travail.

---

## Solution

Implémenter trois modules complémentaires qui clôturent la Phase 4 :

1. **Profil utilisateur** : formulaire d'édition du nom d'affichage + changement de mot de passe via Supabase Auth, accessible depuis `/settings/profile`.
2. **Détail de compte** : page `/accounts/[id]` refactorisée en vue de consultation (historique transactions filtrables + graphique Recharts d'évolution du solde), l'édition déplacée vers `/accounts/[id]/edit`.
3. **Page roadmap consultable** : route `/plan` (Server Component public, sans auth) affichant les phases du projet, le statut de chaque feature, et les décisions d'architecture clés — générée à partir du contenu statique du `PRD.md` et du contexte codebase.

---

## User Stories

1. En tant qu'utilisateur, je veux modifier mon nom d'affichage depuis `/settings/profile`, afin que mon identité soit correcte dans l'interface.
2. En tant qu'utilisateur, je veux changer mon mot de passe depuis `/settings/profile` sans passer par un flux email, afin de sécuriser mon compte facilement.
3. En tant qu'utilisateur, je veux voir un message d'erreur clair si mon ancien mot de passe est incorrect lors du changement.
4. En tant qu'utilisateur, je veux voir la liste des transactions d'un compte spécifique en cliquant sur ce compte depuis `/accounts`, afin d'analyser les mouvements par compte.
5. En tant qu'utilisateur, je veux filtrer les transactions du détail compte par mois, afin de ne pas être noyé dans l'historique complet.
6. En tant qu'utilisateur, je veux voir un graphique d'évolution du solde du compte sur les 6 derniers mois, afin de comprendre les tendances.
7. En tant qu'utilisateur, je veux pouvoir éditer un compte via un lien dédié `/accounts/[id]/edit`, distinct de la vue détail.
8. En tant que propriétaire du projet, je veux accéder à `/plan` sans m'authentifier, afin de partager la roadmap avec des collaborateurs externes.
9. En tant que propriétaire du projet, je veux voir les phases de développement (1 à 4) avec leur statut ✅/🚧/⏳ sur la page `/plan`.
10. En tant que propriétaire du projet, je veux voir pour chaque phase la liste des features et leur état d'implémentation.
11. En tant que propriétaire du projet, je veux voir les décisions d'architecture clés (montants en centimes, soft delete, RLS, etc.) sur la page `/plan`.
12. En tant qu'agent qui reprend le travail, je veux trouver une description du contexte technique à jour sur `/plan`, afin de démarrer sans lire tout le codebase.
13. En tant qu'utilisateur, je veux que le lien vers `/plan` soit discret (ex : footer) et non dans la sidebar principale, afin de ne pas encombrer la navigation.
14. En tant qu'utilisateur, je veux que la page `/plan` se mette à jour au déploiement (statique, pas de polling DB), afin d'être toujours cohérente avec le code déployé.

---

## Implementation Decisions

### Module 1 — Profil utilisateur

- **API** : `PATCH /api/profile` pour update `profiles.full_name` + appel Supabase Auth `updateUser({ password })` pour le mot de passe.
- **Sécurité** : re-authentifier via `signInWithPassword` avec l'ancien mot de passe avant de mettre à jour — ne pas appeler `updateUser` directement sans vérification.
- **Formulaire** : deux sections séparées — « Informations » (nom) et « Sécurité » (ancien mot de passe / nouveau / confirmation). React Hook Form + Zod.
- **Schéma Zod profil** : `{ full_name: z.string().min(1).max(100) }`.
- **Schéma Zod mot de passe** : `{ current_password: z.string().min(6), new_password: z.string().min(8), confirm: z.string() }` avec `.refine(confirm === new_password)`.
- Aucune migration SQL nécessaire — `profiles.full_name` existe déjà.

### Module 2 — Détail de compte

- **Refactoring routes** : `/accounts/[id]` devient la vue détail (Server Component) ; l'édition se déplace vers `/accounts/[id]/edit` (réutilise `AccountForm` existant, déjà complet).
- **Données** : transactions du compte (filtrables par mois, paginated 25/page), solde courant (`initial_balance_cents + SUM(transactions.amount_cents)`), évolution du solde mensuel sur 6 mois.
- **Graphique** : nouveau composant `components/accounts/balance-chart.tsx` (Client Component, Recharts `LineChart`) — le `BarChart` existant n'est pas adapté à une série temporelle de soldes.
- **Filtres** : sélecteur de mois côté client (même pattern que `BudgetList` avec `useState` + `window.history.replaceState`).
- **API** : réutiliser `GET /api/transactions?account_id=&month=` qui existe déjà — aucune nouvelle route.
- **Lien** : modifier les cards dans `accounts/page.tsx` pour pointer vers `/accounts/[id]` (détail) et non `/accounts/[id]/edit`.

### Module 3 — Page roadmap `/plan`

- **Route** : `app/plan/page.tsx` — hors du groupe `(app)` pour être accessible sans auth. Le middleware (`proxy.ts`) n'intercepte pas `/plan`.
- **Rendu** : Server Component pur, contenu entièrement statique hardcodé. Aucun appel DB. Se met à jour à chaque déploiement.
- **Contenu** :
  - En-tête : nom du projet, version, lien GitHub vers `PRD.md`.
  - Section « Phases » : 4 lignes avec badge de statut.
  - Section « Features par module » : tableau par module (Auth, Comptes, Transactions, Budget, Charges fixes, Objectifs, Import, Paramètres, Tests, Déploiement) avec colonne Statut.
  - Section « Décisions techniques » : règles métier clés (centimes, soft delete, RLS, `kind`, Supabase SSR).
  - Section « Stack » : tableau tech stack.
- **Styling** : Tailwind CSS v4, cohérent avec l'app. Pas de sidebar.
- **Lien d'accès** : lien discret dans le footer du layout `app/(app)/layout.tsx`.
- **Pas de composants réutilisables** : page one-shot, JSX direct dans le Server Component — aucune abstraction pour un usage unique.

---

## Testing Decisions

### Critères de bons tests
Tester uniquement le comportement observable externe — ce qu'un utilisateur ferait dans un navigateur (E2E) ou ce que l'API retourne (unit/integration). Ne pas tester les détails d'implémentation internes.

### Modules à tester

**Vitest (unit/integration)** :
- `app/api/profile/route.ts` : PATCH `full_name` valide → 200 + données ; PATCH sans auth → 401 ; PATCH `full_name` vide → 400.
- Prior art : `__tests__/api/savings-goals.test.ts` + `__tests__/mocks/supabase.ts`.

**Playwright (E2E)** :
- Profil : navigation `/settings/profile`, modification nom → confirmation, rechargement → nom persisté.
- Détail compte : clic sur un compte depuis `/accounts` → page `/accounts/[id]` chargée avec transactions et graphique.
- Page plan : `/plan` accessible sans login → titre visible, tableau des phases visible.
- Prior art : `e2e/auth.spec.ts`, `e2e/features.spec.ts` (helper `login(page)` établi).

---

## Out of Scope

- Open Banking ou connexion bancaire automatique.
- Photo de profil.
- Page `/plan` dynamique avec données DB live — la version statique suffit.
- Export PDF de la roadmap.
- Auto-avancement `next_due_date` via Supabase pg_cron — l'avancement au GET `/api/fixed-charges` est suffisant en V1.
- Détail compte pour les virements (accessibles via `/transfers`).

---

## Further Notes

- La migration `20260528100000_phase4_savings_goals.sql` ajoute `linked_category_id`, `color`, `icon` à `savings_goals` — à appliquer avant de tester les objectifs en local (`npx supabase db push`).
- Le workflow CI/CD (`.github/workflows/deploy.yml`) est en place mais nécessite la configuration des secrets GitHub (`VERCEL_TOKEN`, `SUPABASE_PROJECT_REF`, etc.) pour fonctionner — configuration manuelle hors scope de ce PRD.
- `CONTEXT.md` et `docs/adr/` n'existent pas encore dans le repo — pas de conflit ADR.
