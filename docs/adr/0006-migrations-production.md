# 0006 — Migrations de production planifiées puis approuvées

Status: accepted (issue 165)

## Contexte

Vercel déploie l'application via son intégration Git. Les migrations Supabase
étaient appliquées automatiquement après chaque CI verte sur `main`, sans
approbation ; des secrets absents produisaient pourtant un résultat vert.
Nous voulons une validation humaine seulement quand des migrations restent à appliquer.

## Décision

- `Deploy` conserve sa concurrence `deploy-production` sans annulation et les
  seules permissions GitHub `contents: read`. Après une CI réussie sur `main`,
  `plan` checkout le SHA exact de cette CI, lie le projet et exécute uniquement
  `supabase db push --dry-run` (CLI 2.116.0). Aucun SQL de migration n'est appliqué.
- Le CLI écrit la liste sur stderr : stdout et stderr sont réunis dans le résumé.
  Un échec du CLI reste un échec du job. `pending=false` uniquement si la sortie
  contient `Remote database is up to date.` ; toute autre sortie réussie donne
  `pending=true` (comportement conservateur si le format change).
- Texte vérifié dans [le cœur du CLI au tag v2.116.0](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/shared/legacy-db-push-core.ts)
  et [sa documentation des effets](https://github.com/supabase/cli/blob/v2.116.0/apps/cli/src/legacy/commands/db/push/SIDE_EFFECTS.md).
- `apply` dépend de `plan`, utilise le même SHA et ne démarre que si `pending=true`
  et si le lancement manuel n'est pas une simulation. Il relie le projet puis
  applique les migrations après approbation dans **`production-migrations`**.
  Cet environnement existe déjà : relecteur requis **Ant3xes**, branche autorisée
  **main**. Ne pas utiliser `Production`, réservé à Vercel. Sans migration en
  attente, `apply` est sauté : aucune approbation n'est demandée.
- Les trois secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` et
  `SUPABASE_DB_PASSWORD` doivent être disponibles au niveau dépôt pour `plan`
  et les PR autorisées ; des secrets limités à l'environnement ne suffisent pas.
  Sur `workflow_run`, leur absence fait échouer `plan`. Sur lancement manuel,
  elle produit un warning et aucune application. `dry_run` vaut `true` par défaut ;
  les lancements manuels hors `main` sont ignorés.
- `Migrations dry-run` ne se déclenche que sur les PR modifiant
  `supabase/migrations/**` et ne possède aucun environnement ni étape d'application.
  Sans secrets (notamment forks et Dependabot), il réussit avec une notice explicite ;
  la CI habituelle applique et teste toujours les migrations **localement**.
  Ne jamais remplacer `pull_request` par `pull_request_target` : du contenu de PR
  serait alors exécuté avec des secrets privilégiés. Les PR internes ayant accès
  aux secrets restent une frontière de confiance, même avec `--dry-run`.
- Les actions ciblées sont épinglées par SHA complet vérifié via l'API GitHub.
  Dependabot `github-actions` est déjà activé mensuellement et met ces SHA à jour.
  Gitleaks est téléchargé à version fixe et son archive vérifiée avec les checksums
  de la même release avant extraction (cela ne remplace pas une signature indépendante).

## Compatibilité et retour arrière

Les migrations de production sont **additives et rétro-compatibles** : suivre
expand/contract, ajouter les colonnes/tables/API, migrer les données et les clients,
puis supprimer dans une migration ultérieure après disparition des anciens usages.
Vercel et les migrations ne sont pas synchronisés : l'ancien code doit fonctionner
avec le nouveau schéma et le nouveau code doit tolérer le schéma pendant l'approbation.

Avant d'approuver un changement risqué, vérifier les sauvegardes disponibles et la
possibilité de restauration/PITR **selon le plan Supabase réel du projet** ; ne pas
supposer le PITR activé. Définir la fenêtre de perte de données acceptable et tester
la procédure de restauration sur un projet isolé. En incident, suspendre les écritures
si nécessaire, restaurer la sauvegarde ou au point choisi via Supabase, vérifier les
données et l'historique des migrations avant la reprise. Une migration inverse est
écrite et revue **à la main**, puis livrée comme nouvelle migration ; `db push` ne
fournit pas de rollback automatique et une suppression de données n'est pas réversible
sans sauvegarde. Revenir au code Vercel précédent ne restaure pas le schéma.

## Exploitation et désactivation

Après fusion, vérifier les secrets, les règles existantes de `production-migrations`,
le résumé du premier `plan`, puis approuver le premier `apply` uniquement si nécessaire.
Contrôler aussi une CI verte sans migration (apply sauté), une simulation manuelle
sans application et une PR de migration avec/sans secrets. Le workflow `workflow_run`
ne peut être validé de bout en bout avant sa présence sur `main`.

Pour **arrêter** les migrations automatiques, désactiver `Deploy` dans l'onglet Actions
(et annuler tout run encore en attente) ; Vercel reste indépendant. Pour **retirer
l'approbation humaine**, un administrateur peut enlever le relecteur requis dans
Settings → Environments → `production-migrations` → protection rules, après décision
explicite et revue du risque. Cela permet les applications sans garde-fou : conserver
la restriction `main`, ne pas supprimer le dry-run ni remettre les secrets absents
au vert. Réactiver le relecteur pour rétablir la protection.
