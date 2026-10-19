# 0008 — Durcissement additif de la base

Statut : proposé, issue #169 ; approbation humaine avant fusion/application.

## Décision et compatibilité

Suivre [ADR 0006](0006-migrations-production.md) : aucune ligne existante modifiée,
aucun objet supprimé, migration `20261020110000_db_hardening.sql` rejouable.
Les CHECK sont tous **NOT VALID** : pas de scan bloquant ni d'hypothèse sur
l'existant. Ils contrôlent néanmoins immédiatement chaque INSERT/UPDATE ; une
ancienne ligne non conforme ne pourra plus être mise à jour sans correction.
Les nouveaux index sont non uniques et utilisent `IF NOT EXISTS`. Pas de
`CONCURRENTLY` (transaction de migration) : tables de 2–5 utilisateurs annoncées,
verrouillage court accepté, à reconsidérer si la volumétrie réelle a changé.

### Index

L'index existant `transactions_space_account_date_idx` est déjà partiel
`(space_id, account_id, date) WHERE deleted_at IS NULL`. Pour un espace et compte
fixés, le parcours btree inverse satisfait `ORDER BY date DESC` : aucun doublon.
`transactions_space_date_idx` reste intact. Les index partiels existants
`transactions_reimburses_idx` et `settlements_one_per_source_idx` couvrent toutes
les valeurs FK non nulles ; ne pas les dupliquer. Audit LOCAL pg_constraint /
pg_index : 25 autres FK sans préfixe couvrant, index créés ci-dessous (tous btree).
La requête d'audit complète est dans `db_hardening.test.sql`.

- accounts : `accounts_user_id_idx`.
- budgets : `budgets_user_id_idx`, `budgets_category_id_idx`.
- categories : `categories_user_id_idx`.
- csv_import_rules : `csv_import_rules_category_id_idx`, `csv_import_rules_user_id_idx`, `csv_import_rules_share_space_id_idx`, `csv_import_rules_share_category_id_idx`.
- fixed_charges : `fixed_charges_user_id_idx`, `fixed_charges_account_id_idx`, `fixed_charges_category_id_idx`.
- invitations : `invitations_space_id_idx`, `invitations_inviter_user_id_idx`, `invitations_accepted_by_user_id_idx`.
- savings_goals : `savings_goals_user_id_idx`, `savings_goals_linked_category_id_idx`.
- settlements : `settlements_from_user_idx`, `settlements_to_user_idx`, `settlements_created_by_idx`.
- shared_expenses : `shared_expenses_paid_by_idx`, `shared_expenses_category_id_idx`.
- spaces : `spaces_created_by_idx`.
- transactions : `transactions_user_id_idx`, `transactions_account_id_idx`, `transactions_category_id_idx`.

### Policies et droits

44 policies existantes modifiées uniquement par `ALTER POLICY`, expressions
recopiées du catalogue. `auth.uid()` devient `(select auth.uid())` (InitPlan
possible) ; `is_space_member`, `is_space_owner`, `shares_space_with` sont enveloppés
sans modifier leurs arguments. **Les appels dépendant de la ligne restent
corrélés** : cela ne prouve pas une mémorisation par espace ni un gain de débit.
Rôles, commandes, permissivité et branches logiques inchangés.

- Pour `accounts`, `categories`, `transactions`, `budgets`, `fixed_charges`,
  `savings_goals`, `csv_import_rules` : les 4 policies `<table>_select_member`,
  `<table>_insert_member`, `<table>_update_member`, `<table>_delete_member`.
- Autres policies : `profiles_update_own`, `spaces_select_member`, `spaces_update_owner`, `spaces_delete_owner`, `space_members_select_member`, `space_members_delete`, `profiles_select_self_or_comember`, `invitations_select`, `invitations_revoke`, `shared_expenses_select_member`, `shared_expenses_insert_payer`, `shared_expenses_update_payer`, `shared_expenses_delete_payer`, `settlements_select_member`, `settlements_insert_party`, `settlements_delete_creator`.
- `invitations_insert` reste strictement inchangée : jointure `EXISTS` délicate.
- Aucune référence à la migration démo dans le SQL ; ses policies restrictives
  et ses fonctions ne sont ni remplacées ni supprimées.

Retrait de SELECT/INSERT/UPDATE/DELETE à `anon` sur les 13 tables privées :
`accounts`, `budgets`, `categories`, `csv_import_rules`, `fixed_charges`, `invitations`, `profiles`, `savings_goals`, `settlements`, `shared_expenses`, `space_members`, `spaces`, `transactions`.
Les droits `authenticated` et `service_role`, séquences et autres privilèges
ne changent pas. Les droits par défaut CRUD `anon` sont retirés pour `postgres`
(global + schéma public : les deux ACL s'additionnent), et `supabase_admin` dans
public **si le rôle de migration peut le gérer**, sinon NOTICE et action
administrateur requise ci-dessous. Les ACL des schémas système restent intactes.
L'application n'accède anonymement aux invitations que via
`get_space_invitation(text)`, SECURITY DEFINER : EXECUTE anon reste autorisé.
Les routes privées emploient `withSpace` / `requireSpaceContext`.

### Intégrité et limites explicites

`prevent_user_change()` rejette avec 23514 un `user_id` différent de OLD, y compris
NULL. Triggers sur les 7 tables métier listées plus haut ; une mise à jour avec
le même auteur reste permise. Pas sur `space_members` (clé d'adhésion, pas auteur).
EXECUTE direct de cette fonction trigger retiré à PUBLIC/anon/authenticated.

17 CHECK ajoutés, **tous NOT VALID**, bornes supérieures uniquement (NULL conservé) :

- accounts : `accounts_currency_format` : `currency ~ '^[A-Z]{3}$'` ; `accounts_name_length` : `char_length(name) <= 200`.
- budgets : `budgets_currency_format` : `currency ~ '^[A-Z]{3}$'`.
- categories : `categories_name_length` : `char_length(name) <= 200`.
- fixed_charges : `fixed_charges_currency_format` : `currency ~ '^[A-Z]{3}$'` ; `fixed_charges_name_length` : `char_length(name) <= 200` ; `fixed_charges_notes_length` : `char_length(notes) <= 10000`.
- profiles : `profiles_default_currency_format` : `default_currency ~ '^[A-Z]{3}$'` ; `profiles_full_name_length` : `char_length(full_name) <= 200`.
- savings_goals : `savings_goals_currency_format` : `currency ~ '^[A-Z]{3}$'` ; `savings_goals_name_length` : `char_length(name) <= 200`.
- shared_expenses : `shared_expenses_currency_format` : `currency ~ '^[A-Z]{3}$'` ; `shared_expenses_description_length` : `char_length(description) <= 10000`.
- spaces : `spaces_name_length` : `char_length(name) <= 200`.
- transactions : `transactions_currency_format` : `currency ~ '^[A-Z]{3}$'` ; `transactions_description_length` : `char_length(description) <= 10000` ; `transactions_notes_length` : `char_length(notes) <= 10000`.

Pas de CHECK global sur le signe `amount_cents` : les virements et remboursements
(`20261017090000_linked_reimbursements.sql`) ont déjà des validations contextuelles ;
ne pas généraliser cette règle sans clarifier tous les contrats historiques.

**Suivi non résolu : token d'invitation encore lisible par un co-membre.**
Ne pas présenter cette PR comme corrigeant ce point. La page `/invitations` liste
les métadonnées pour tout l'espace ; POST compte toutes les invitations en attente,
DELETE permet à un propriétaire de révoquer l'invitation d'un autre membre.
Restreindre les lignes à l'inviteur/acceptant casserait ces contrats. Un retrait
SELECT sur la seule colonne token préserverait les projections actuelles de l'app,
mais casserait les accès historiques par token (notamment les tests RLS existants,
à conserver intacts), et SELECT * du contrat PostgREST. Choix expand/contract :
introduire une vue/RPC sans token pour la liste et le comptage, adapter les clients
et les tests de ce contrat dans un suivi applicatif, puis fermer la lecture directe.
Aucun code applicatif hors périmètre modifié. Le nouveau test expose explicitement
la visibilité actuelle, pas une fausse garantie de confidentialité. L'anon ne peut
pas lire la table ; la prévisualisation RPC ne renvoie jamais le token.

## Contrôles manuels avant approbation de production

Aucune commande distante exécutée par l'agent. Vérifier sauvegarde/restauration,
volumétrie, index homonymes (IF NOT EXISTS ne garantit pas une définition identique),
les policies n'ayant pas dérivé, et l'absence d'intégrations anonymes hors dépôt.
Exécuter en lecture seule **avant** application ; chaque compteur doit être zéro,
ou décider explicitement comment traiter les anciennes lignes non conformes
avant leurs prochaines mises à jour (ne pas les corriger automatiquement ici) :

```sql
select 'accounts.accounts_currency_format' as check_name, count(*) as violations from public.accounts where not (currency ~ '^[A-Z]{3}$')
union all
select 'accounts.accounts_name_length' as check_name, count(*) as violations from public.accounts where not (char_length(name) <= 200)
union all
select 'budgets.budgets_currency_format' as check_name, count(*) as violations from public.budgets where not (currency ~ '^[A-Z]{3}$')
union all
select 'categories.categories_name_length' as check_name, count(*) as violations from public.categories where not (char_length(name) <= 200)
union all
select 'fixed_charges.fixed_charges_currency_format' as check_name, count(*) as violations from public.fixed_charges where not (currency ~ '^[A-Z]{3}$')
union all
select 'fixed_charges.fixed_charges_name_length' as check_name, count(*) as violations from public.fixed_charges where not (char_length(name) <= 200)
union all
select 'fixed_charges.fixed_charges_notes_length' as check_name, count(*) as violations from public.fixed_charges where not (char_length(notes) <= 10000)
union all
select 'profiles.profiles_default_currency_format' as check_name, count(*) as violations from public.profiles where not (default_currency ~ '^[A-Z]{3}$')
union all
select 'profiles.profiles_full_name_length' as check_name, count(*) as violations from public.profiles where not (char_length(full_name) <= 200)
union all
select 'savings_goals.savings_goals_currency_format' as check_name, count(*) as violations from public.savings_goals where not (currency ~ '^[A-Z]{3}$')
union all
select 'savings_goals.savings_goals_name_length' as check_name, count(*) as violations from public.savings_goals where not (char_length(name) <= 200)
union all
select 'shared_expenses.shared_expenses_currency_format' as check_name, count(*) as violations from public.shared_expenses where not (currency ~ '^[A-Z]{3}$')
union all
select 'shared_expenses.shared_expenses_description_length' as check_name, count(*) as violations from public.shared_expenses where not (char_length(description) <= 10000)
union all
select 'spaces.spaces_name_length' as check_name, count(*) as violations from public.spaces where not (char_length(name) <= 200)
union all
select 'transactions.transactions_currency_format' as check_name, count(*) as violations from public.transactions where not (currency ~ '^[A-Z]{3}$')
union all
select 'transactions.transactions_description_length' as check_name, count(*) as violations from public.transactions where not (char_length(description) <= 10000)
union all
select 'transactions.transactions_notes_length' as check_name, count(*) as violations from public.transactions where not (char_length(notes) <= 10000);

-- Contrôle ACL de tous les rôles créateurs, avant et après application.
select pg_get_userbyid(d.defaclrole) as creator,
       d.defaclnamespace::regnamespace as schema, a.privilege_type
from pg_default_acl d cross join lateral aclexplode(d.defaclacl) a
where d.defaclobjtype = 'r' and d.defaclnamespace in (0, 'public'::regnamespace)
  and a.grantee = 'anon'::regrole
  and a.privilege_type in ('SELECT', 'INSERT', 'UPDATE', 'DELETE');
-- Si une ACL supabase_admin subsiste après le NOTICE, l'administrateur exécute :
alter default privileges for role supabase_admin in schema public
  revoke select, insert, update, delete on tables from anon;
```

Après application et compteurs à zéro, produire les 17 commandes de validation
(ci-dessous génère du texte, ne l'exécute pas). Les faire relire puis les exécuter
manuellement lors d'une fenêtre compatible avec le scan/verrou de validation :

```sql
select format('alter table public.%I validate constraint %I;', c.relname, k.conname)
from pg_constraint k join pg_class c on c.oid = k.conrelid
where c.relnamespace = 'public'::regnamespace and not k.convalidated
  and k.conname in (
    'accounts_currency_format',
    'accounts_name_length',
    'budgets_currency_format',
    'categories_name_length',
    'fixed_charges_currency_format',
    'fixed_charges_name_length',
    'fixed_charges_notes_length',
    'profiles_default_currency_format',
    'profiles_full_name_length',
    'savings_goals_currency_format',
    'savings_goals_name_length',
    'shared_expenses_currency_format',
    'shared_expenses_description_length',
    'spaces_name_length',
    'transactions_currency_format',
    'transactions_description_length',
    'transactions_notes_length'
  );
```

## Vérifications locales

- Suite existante intacte : `npm run db:reset && npm run test:db` ; nouveau fichier
  pgTAP avec `plan(55)`, compte statique de 55 assertions, vérifie RLS hors
  extensions, zéro CRUD anon, couverture de chaque FK, 25 index, 17 NOT VALID,
  auteur immuable et UPDATE normal sur les 7 tables, contrats invitation et ACL futures.
- Migration rejouée en transaction : succès, index déjà présents ignorés.
  Application également réussie sur une fixture historique avec devise `eur` et
  nom de 300 caractères : ligne conservée sans modification, puis fixture nettoyée.
- Suite finale sans démo et suite avec démo : `Files=13, Tests=319`, `Result: PASS`.
- Ordre réel testé avec la migration de PR #177 (SHA
  `f99ccb17616d66f0e1871a09020fd6d8d6d8b692`) puis celle-ci ; les 39 policies
  restrictives démo restent identiques octet pour octet dans le catalogue.
- `npm run db:types` : aucun diff ; `npm run check` : 94 fichiers / 1102 tests,
  11 avertissements ESLint préexistants, zéro erreur. `npm run build` réussi.
- EXPLAIN ANALYZE avant/après sur espace/compte/période actifs : base vide,
  `Index Scan transactions_space_id_idx` puis tri dans les deux cas ; 0 ligne,
  respectivement 0,505 ms / 0,078 ms d'exécution. **Pas une mesure de gain**
  (cache et catalogue différents). Aucun benchmark de charge, distribution réelle,
  débit RLS, temps de verrou en production ou advisors distants mesuré.
