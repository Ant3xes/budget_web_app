# 0003 — Date d'ancrage du solde

Status: accepted (implémenté dans l'issue 104)

## Contexte

Le solde d'un compte était `initial_balance_cents` + somme de **toutes** les
transactions non supprimées. Un utilisateur qui n'importe qu'une partie de son
historique obtenait un solde faux : le solde saisi à la création est celui du
jour de création, pas celui d'avant l'historique importé.

## Décision

- Terme : **date d'ancrage du solde** (`accounts.balance_anchor_date`, `date not null`).
- Règle unique : `solde = initial_balance_cents + somme(amount_cents des transactions
  non supprimées dont date > date d'ancrage)`. Implémentée une seule fois, dans
  `lib/accounts/balance-after-anchor.ts` (fonction pure), et utilisée partout où
  un solde est calculé (listes de comptes, détail, courbes, dashboard, analytics).
- Les transactions datées **≤ ancrage** restent en base et visibles partout
  (listes, catégories, dépenses/revenus, flux) ; elles sont seulement exclues du solde.
- L'ancrage est fixé **à la création** (date du jour en `Europe/Paris`, posée par
  l'API) et **n'est pas modifiable** : le PATCH ne le touche pas.
- Comptes existants : migration avec `'1900-01-01'` → toutes leurs opérations
  continuent de compter, soldes inchangés. Le défaut de colonne après migration
  est `current_date` (filet de sécurité ; l'API fournit toujours la date Paris).
- Les virements internes suivent la même règle de date que les autres transactions.
- Courbes : avant l'ancrage, la courbe affiche le solde initial constant. Les vues
  multi-comptes filtrent transaction par transaction selon l'ancrage de **son** compte
  (jamais un seul total initial + toutes les transactions).

## Point d'attention

Une opération **saisie à la main datée du jour de création** n'est **pas** comptée
dans le solde (même règle que l'import : `date > ancrage` strict). Ce n'est pas
contourné volontairement : pour qu'elle compte, elle doit être datée après la création.

## Conséquences

- Les deux dates se comparent en `YYYY-MM-DD` (chaînes), sans fuseau.
- Modifier le solde initial après coup reste possible (PATCH) ; l'ancrage, non.
