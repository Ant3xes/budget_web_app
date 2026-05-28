## Problem Statement

Avant cette phase, il n'existait aucune application. Il fallait partir de zéro pour poser les **fondations techniques et fonctionnelles** sur lesquelles toutes les phases suivantes allaient s'appuyer :

1. **Infrastructure projet** : Next.js 14 + Supabase + Tailwind CSS devaient être configurés ensemble avec TypeScript strict, SSR via App Router, et un système de clients Supabase adapté (server vs browser).

2. **Authentification** : les utilisateurs ne pouvaient ni s'inscrire, ni se connecter, ni se déconnecter. Il fallait un système auth email/password complet avec redirection post-login.

3. **Système d'invitation** : l'application est limitée à un propriétaire + 2–5 amis invités. Sans système d'invitation, aucun ami ne pouvait rejoindre l'app.

4. **Schéma de base de données** : toutes les tables (`profiles`, `accounts`, `categories`, `transactions`, `budgets`, `savings_goals`, `csv_import_rules`) devaient être créées avec leurs politiques RLS pour garantir l'isolation totale par utilisateur.

5. **CRUD Comptes** : le compte bancaire est l'entité centrale de l'app. Sans gestion des comptes, aucune transaction, budget ou objectif ne peut exister.

6. **Layout et navigation** : sans sidebar et structure de navigation, l'app n'est pas utilisable.

## Solution

Bootstrapper l'application de bout en bout avec les fondations techniques solides, puis implémenter les fonctionnalités minimales pour qu'un utilisateur puisse s'inscrire, inviter des amis, et gérer ses comptes bancaires.

1. **Infra** : Next.js 14 App Router + Tailwind CSS v4 + Supabase (PostgreSQL + Auth). Clients Supabase distincts : `createServerSupabaseClient` (SSR) pour Server Components et API routes, `createBrowserClient` pour Client Components.

2. **Auth** : Server Actions `login`, `signup`, `logout`. Pages `/login` et `/signup`. Auth guard dans l'AppLayout (redirection `/login` si non authentifié). Trigger SQL `handle_new_user` crée automatiquement un profil à l'inscription.

3. **Invitations** : `POST /api/invitations` génère un lien unique (UUID token, max 5 invitations actives). Page `/invite/[token]` permet d'accepter une invitation. Page `/invitations` dans l'app permet de gérer ses invitations envoyées.

4. **Schéma BDD complet** : migration unique `20260527183000_phase1.sql` crée l'intégralité du schéma, les triggers `set_updated_at`, et toutes les politiques RLS.

5. **CRUD Comptes** : API REST (`GET/POST/PATCH/DELETE /api/accounts`), page liste `/accounts`, page édition `/accounts/[id]`, composants `AccountForm` et `DeleteAccountButton`. Solde courant calculé en temps réel : `initial_balance_cents + Σ transactions non supprimées`.

6. **Layout** : `AppLayout` avec auth guard, `Sidebar` avec navigation complète (8 entrées), header avec email utilisateur et bouton logout.

## User Stories

1. As a user, I want to sign up with my email and password, so that I can create my personal budget space.
2. As a user, I want to log in with my email and password, so that I can access my data.
3. As a user, I want to be redirected to the dashboard after login, so that I land on the most useful page.
4. As a user, I want to log out from any page, so that I can secure my session.
5. As a user, I want to be automatically redirected to `/login` when I'm not authenticated, so that I can't access protected pages without credentials.
6. As a user, I want my profile to be created automatically at signup, so that I don't need to fill in extra info before using the app.
7. As an owner, I want to invite up to 5 friends by email, so that they can join the app with their own isolated space.
8. As an invitee, I want to receive a unique invitation link, so that I can sign up and accept the invitation.
9. As an invitee, I want to see a clear message if the invitation doesn't exist or has already been accepted, so that I'm not left confused.
10. As a user, I want to manage my sent invitations (view status, revoke), so that I control who can join.
11. As a user, I want to create a bank account with a name, type, and initial balance, so that I can start tracking my finances.
12. As a user, I want to see a list of all my accounts with their current balance, so that I have a quick overview of my financial situation.
13. As a user, I want to edit an account's name, type, and initial balance, so that I can correct mistakes.
14. As a user, I want to soft-delete an account, so that it's removed from the list without permanently losing data.
15. As a user, I want the current balance to be computed as `initial_balance + sum of non-deleted transactions`, so that the balance reflects all activity.
16. As a user, I want to navigate between sections (Dashboard, Accounts, Expenses, Incomes, Transfers, Budget, Fixed Charges, Goals, Settings) via a sidebar, so that I can move around the app efficiently.
17. As a user, I want the sidebar to be visible on desktop and collapsible on mobile, so that the app is usable on all screen sizes.

## Implementation Decisions

### Module 1 — Authentification (`/login`, `/signup`)

- Server Actions (`login`, `signup`, `logout`) dans `app/(auth)/actions.ts` — pattern Next.js App Router natif, pas d'API routes dédiées pour l'auth.
- `signup` appelle `supabase.auth.signUp` avec `emailRedirectTo` basé sur `NEXT_PUBLIC_SITE_URL`. Si la session est immédiatement disponible (email non requis en dev), redirection directe vers `/dashboard`. Sinon, redirection vers `/login` avec message de confirmation.
- `login` redirige vers `/dashboard` en cas de succès, vers `/login?message=...` en cas d'erreur.
- Auth guard dans `AppLayout` : `supabase.auth.getUser()` côté serveur, `redirect("/login")` si absent. Pas de middleware complexe — le guard est dans le layout.
- `hasSupabaseConfig` flag pour afficher un message d'erreur si les variables d'environnement sont manquantes (DX en développement).

### Module 2 — Profils & Trigger (`handle_new_user`)

- Table `profiles` : `id` = `auth.users.id` (clé étrangère), `full_name` (défaut : préfixe email), `default_currency` (défaut : `EUR`).
- Trigger SQL `on_auth_user_created` (security definer) : inséré automatiquement à chaque nouvel utilisateur Supabase Auth.
- `full_name` initialisé avec `coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1))`.

### Module 3 — Système d'invitation

- Table `invitations` : `token UUID unique`, `status` (`pending` / `accepted` / `revoked`), `inviter_user_id`, `invitee_email`, `accepted_by_user_id`.
- `POST /api/invitations` : vérifie la limite de 5 invitations actives (pending + accepted), génère un `randomUUID()` comme token, retourne le lien complet `{NEXT_PUBLIC_SITE_URL}/invite/{token}`.
- Page `/invite/[token]` (Server Component) : vérifie l'existence de l'invitation, affiche un état adapté (non trouvée, déjà acceptée, redirection si déjà connecté et invitation valide).
- Page `/invitations` dans l'app : liste les invitations envoyées avec leur statut.

### Module 4 — Schéma BDD complet

- Migration unique `20260527183000_phase1.sql` : crée **toutes les tables** de l'application (pas seulement Phase 1) pour avoir un schéma cohérent dès le départ.
- Tables créées : `profiles`, `invitations`, `accounts`, `categories`, `transactions`, `budgets`, `subscriptions` (renommée plus tard en `fixed_charges`), `savings_goals`, `csv_import_rules`.
- Trigger `set_updated_at` partagé entre toutes les tables.
- Index composite `(user_id, date DESC)` sur `transactions` + index partiel sur `transfer_id`.
- RLS activé sur toutes les tables avec politiques `user_id = auth.uid()`.
- Toutes les politiques sont permissives (`FOR ALL`) sauf `invitations` (logique asymétrique inviteur/invité).

### Module 5 — CRUD Comptes

- API REST complète sur `/api/accounts` : `GET` (liste), `POST` (création), `PATCH` (édition), `DELETE` (soft delete via `deleted_at`).
- Validation Zod sur tous les endpoints : `accountSchema` (name, type, initialBalanceCents, currency), `deleteSchema` (id UUID).
- Types de compte autorisés : `courant`, `épargne`, `livret`, `PEL`, `autre` (enum Zod + contrainte SQL CHECK).
- Helper `withUser()` factorisé dans la route pour éviter la répétition du check auth.
- Page `/accounts` (Server Component) : fetch comptes + transactions via jointure Supabase, calcul solde en JS, rendu tableau.
- Composant `AccountForm` (Client Component, `react-hook-form` + Zod) : création et édition dans le même formulaire (présence de `id` détermine le mode).
- Composant `DeleteAccountButton` (Client Component) : appelle `DELETE /api/accounts` + `router.refresh()`.
- Page `/accounts/[id]` : formulaire d'édition pré-rempli (Server Component qui fetch le compte, puis passe les données à `AccountForm`).

### Module 6 — Layout & Navigation

- `AppLayout` (`app/(app)/layout.tsx`) : vérifie auth côté serveur, affiche header (email + logout) + `<Sidebar>` + zone `<main>`.
- `Sidebar` (`components/layout/sidebar.tsx`) : navigation avec 9 entrées (Dashboard, Accounts, Expenses, Incomes, Transfers, Budget, Fixed Charges, Goals, Settings). Client Component pour gérer l'état actif.
- Structure de routing : `app/(app)/` pour les pages protégées, `app/(auth)/` pour login/signup, `app/invite/` pour le flow public d'invitation.

### Data shape — Calcul solde

```ts
const balance = account.initial_balance_cents +
  account.transactions
    .filter(t => t.deleted_at === null)
    .reduce((sum, t) => sum + t.amount_cents, 0);
```

### Schema / API

Toutes les tables créées en Phase 1. Migrations complémentaires créées ensuite :
- `20260527190000` : remplacement de `subscriptions` par `fixed_charges`
- `20260527200000` : ajout colonne `icon` à `categories`

## Testing Decisions

### What makes a good test here

Tester le comportement externe observable (ce que l'utilisateur voit, ce qui est persisté), pas les détails d'implémentation (quel client Supabase est appelé, état interne React).

### Modules à tester

- **Auth Server Actions** : tester la validation des formulaires login/signup (email format, password longueur min). Mock minimal du client Supabase pour tester la gestion d'erreur.
- **Zod schemas des API routes** : unit-tests sur `accountSchema` — valider les cas limites (name vide, type invalide, montant non entier).
- **Calcul solde** : fonction pure `computeBalance(initialBalance, transactions)` — entrée/sortie déterministe, idéal pour unit test.
- **Limite d'invitations** : tester la logique de blocage à 5 invitations via mock du count Supabase.

### Prior art

- Pattern RHF + Zod : voir `account-form.tsx`.
- Pattern Server Action : voir `app/(auth)/actions.ts`.
- Pattern API route avec `withUser()` : voir `/api/accounts/route.ts`.

## Out of Scope

- OAuth / SSO (Google, GitHub) — authentification email/password uniquement en Phase 1.
- Réinitialisation de mot de passe par email — flow `resetPasswordForEmail` différé.
- Modification du mot de passe depuis l'app — différé à Phase 4.
- Catégories par défaut pré-créées au signup — différé à une migration dédiée (Phase 2).
- Archivage de compte (différent du soft delete) — non implémenté.
- Pagination sur la liste des comptes — non nécessaire pour le volume attendu (< 10 comptes).
- Tests E2E Playwright — différés à la phase de polish.

## Further Notes

- Le schéma complet est créé en Phase 1 (pas de migration partielle), ce qui permet à toutes les pages de l'app d'être scaffoldées sans bloquer sur des migrations manquantes.
- La table `subscriptions` (créée en Phase 1) a été remplacée par `fixed_charges` dès la migration suivante — le concept métier a évolué entre la rédaction du PRD et l'implémentation.
- `createServerSupabaseClient` est `async` (pattern SSR Next.js 14+) — les appels doivent être `await`ed, contrairement au browser client qui est synchrone.
- Le layout utilise `user.email` dans le header, pas `profile.full_name` — simple et robuste car l'email est toujours disponible depuis `auth.getUser()` sans query supplémentaire.
- L'isolation par RLS est la seule garantie de sécurité des données — elle doit être testée manuellement en vérifiant qu'un user B ne peut pas lire les données du user A même avec un token valide.
