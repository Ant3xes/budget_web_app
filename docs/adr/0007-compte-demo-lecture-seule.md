# 0007 — Compte démo en lecture seule

Status: accepted (issue 166, partie base de données)

## Contexte

La démo publique utilise un compte Auth partagé, avec uniquement des données
fictives. Un rôle de membre `viewer` imposerait de modifier les policies de
production et ne protégerait pas toutes les écritures hors des espaces partagés.

## Décision

- `demo_users(user_id)` est un registre administré uniquement par un opérateur :
  RLS activée, aucune policy, aucun privilège pour `anon` et `authenticated`.
  `is_demo_user()` est `STABLE SECURITY DEFINER`, avec `search_path = public` ;
  seul `authenticated` peut l'appeler parmi les rôles API publics.
- Ajouter trois policies `AS RESTRICTIVE` (INSERT, UPDATE, DELETE) par table,
  conditionnées par `not public.is_demo_user()`. Ne modifier/supprimer aucune
  policy existante, notamment SELECT. Aucun changement des rôles de membre.
- Inventaire vérifié sur `information_schema.tables` après les migrations :
  `accounts`, `budgets`, `categories`, `csv_import_rules`, `fixed_charges`,
  `invitations`, `profiles`, `savings_goals`, `settlements`, `shared_expenses`,
  `space_members`, `spaces`, `transactions`. Les nouvelles tables métier devront
  recevoir les mêmes restrictions ; le test vérifie aussi le nombre de tables.
- Les RPC d'écriture `create_shared_space(text)` et
  `accept_space_invitation(text)` sont `SECURITY DEFINER` et exécutables par
  `authenticated` : garde explicite au début, erreur `42501`.
  Les RPC `import_transactions(jsonb,jsonb)`, `share_transactions(jsonb)` et
  `convert_transaction(uuid,uuid,text,uuid,integer,date,text,uuid,text,text,uuid,integer)`
  sont `SECURITY INVOKER` et soumis à la RLS ; ils reçoivent aussi ce garde pour
  refuser les appels vides ou les mises à jour qui seraient silencieusement filtrées.
  Leurs dernières définitions sont recopiées sans autre changement.
- Audit de `pg_proc`, `pg_get_functiondef` et `has_function_privilege` :
  `sync_shared_expense`, `clear_reimbursements_on_target_change`,
  `sync_shared_expense_reimbursed`, `init_shared_expense_reimbursed` sont des
  triggers definer non exécutables par les rôles API ; `handle_new_user` retourne
  `trigger` (pas une RPC appelable directement). Pas de garde sur ces fonctions.
  `seed_default_categories`, `personal_space_id` et `reimbursed_total` sont
  internes, sans droit d'exécution pour `authenticated`. Les autres fonctions
  definer accessibles (`is_space_member`, `is_space_owner`, `shares_space_with`,
  `get_space_invitation`) sont en lecture seule.
- Le seed manuel `supabase/demo/seed-demo.sql` est exclu des migrations et du
  seed automatique. Créer d'abord l'utilisateur Auth, remplacer l'email documenté
  en tête, puis exécuter comme `postgres` dans le SQL editor. Il utilise son
  espace personnel et les catégories existantes : 3 comptes, 144 transactions
  déterministes de novembre 2025 à octobre 2026, 4 budgets, 2 objectifs,
  3 charges fixes. La relance conserve les lignes existantes, sans doublons.

## Vérification et conséquences

Les tests pgTAP utilisent `authenticated` et un JWT démo : SELECT autorisé,
INSERT/RPC refusés avec `42501`, isolation des données privées, écritures normales
préservées. PostgreSQL filtre silencieusement UPDATE/DELETE via `USING` : les
assertions vérifient **zéro ligne modifiée**, et non une exception inexistante.
Les permissions déjà révoquées (par exemple UPDATE sur `settlements`) continuent
de produire `42501`. Le front doit désactiver les actions d'écriture plutôt que
supposer qu'une réponse SQL sans erreur signifie qu'une ligne a changé.

Les droits administratifs / `service_role` contournent volontairement la RLS.
Le compte démo doit rester dans son espace personnel fictif : un membre normal
d'un espace partagé peut toujours modifier les données partagées, même si la démo
les lit. Ne jamais inviter ce compte dans un espace réel. Les liens d'invitation
restent consultables par leur jeton selon le comportement existant.

## Limite connue : API Auth

Un porteur du jeton de session démo peut appeler l'API Auth pour changer le mot
de passe ou l'email du compte démo ; la RLS SQL ne protège pas les endpoints Auth.
Le mot de passe n'est utilisé que côté serveur par l'application. Mitigation :
le propriétaire réinitialise les identifiants (et révoque les sessions si besoin).
Aucune donnée réelle ne doit être présente sur ce compte. La création manuelle
du compte, les variables serveur et la désactivation du signup public restent des
opérations humaines / de la partie UI ; aucune migration ne crée d'identifiant.
