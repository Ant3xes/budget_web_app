# Glossaire du domaine — Budget & Comptes

Vocabulaire utilisé dans le code, les issues et les tests. Sources : `docs/adr/`, `docs/prd/`, `supabase/migrations/`, `lib/`. Les décisions détaillées sont dans les ADR.

## Espaces et personnes

- **Espace** (`spaces`) : conteneur qui possède les données (comptes, catégories, transactions, budgets, charges fixes, objectifs, règles d'import). Chaque ligne porte un `space_id`. ADR 0001.
- **Espace personnel** : créé à l'inscription, un seul membre, jamais partageable ni supprimable. Les flux réels y restent à leur montant complet.
- **Espace commun** (partagé) : créé avec `create_shared_space()`, plusieurs membres. *À ne pas confondre avec* un compte joint : une dépense sur un compte d'un espace commun est déjà commune et ne crée jamais de dette.
- **Espace actif** : l'espace dans lequel travaille l'app (cookie `active-space`, revalidé à chaque requête par `getSpaceContext()`).
- **Membre** (`space_members`) : utilisateur d'un espace, rôle `owner` ou `member`, mêmes droits sur les données. Quitter un espace laisse ce que le membre y a créé.
- **Auteur** : `user_id` d'une ligne ; il reste l'auteur, la visibilité dépend de `space_id`.
- **Invitation** (`invitations`) : statut `pending` / `accepted` / `revoked`, jeton unique. Une invitation d'espace est acceptée via `accept_space_invitation()`. L'ancienne invitation d'ami sans accès aux données est remplacée.

## Comptes et transactions

- **Compte** (`accounts`) : type `courant`, `épargne`, `livret`, `PEL` ou `autre`, rattaché à une banque.
- **Solde initial** (`initial_balance_cents`) : solde saisi à la création du compte.
- **Solde ancré** / **date d'ancrage** (`balance_anchor_date`) : solde = solde initial + somme des transactions non supprimées de date strictement postérieure à l'ancrage. Règle unique : `lib/accounts/balance-after-anchor.ts`. Les transactions ≤ ancrage restent visibles mais hors solde. ADR 0003.
- **Transaction** (`transactions`) : montant en centimes entiers (`amount_cents`), suppression logique (`deleted_at`). Type (`kind`) : `expense`, `income`, `transfer_debit`, `transfer_credit`.
- **Virement interne** : deux transactions (`transfer_debit` + `transfer_credit`) liées par `transfer_id` entre deux comptes. Les virements internes suivent la même règle d'ancrage.
- **Virement externe** : choix à l'import pour un virement bancaire traité comme une simple dépense ou un simple revenu (`lib/import/transfer-choice.ts`). L'import est bloqué tant que ce choix interne/externe n'est pas fait.
- **Catégorie** (`categories`) : propre à un espace, avec icône et nom par défaut traduit (`translation_key`).
- **Marchand** : entrée de `data/merchants.json` (nom propre, motifs de libellé bancaire, `category_key`, sens dépense/revenu), utilisée à l'import pour reconnaître un libellé (`lib/import/merchants.ts`).
- **Règle d'import** (`csv_import_rules`) : mot-clé → catégorie, sens `expense` / `income`, ordre de `priority` (la première règle qui correspond gagne). Peut aussi partager automatiquement une dépense (voir ci-dessous). ADR 0002.

## Budget et épargne

- **Budget** (`budgets`) : enveloppe mensuelle par catégorie (`month`, `amount_cents`), unique par espace/catégorie/mois.
- **Charge fixe** (`fixed_charges`) : dépense récurrente (`monthly` / `quarterly` / `yearly`), prochaine échéance `next_due_date`, statut `active` / `suspended` / `cancelled`. Remplace les anciens « abonnements ».
- **Objectif d'épargne** (`savings_goals`) : montant cible, montant courant, échéance optionnelle.

## Remboursements

- **Remboursement lié** : transaction entrante (`income` ou `transfer_credit`, montant > 0) rattachée à une dépense via `reimburses_transaction_id`. Une dépense peut avoir plusieurs remboursements ; un remboursement n'en couvre qu'une. ADR 0004.
- **Montant net** : `max(0, |dépense| − somme(remboursements liés non supprimés))` (`lib/transactions/net-amount.ts`). Il compte pour les dépenses, revenus et budgets ; **jamais** pour les soldes, qui somment le brut. *À ne pas confondre avec* un règlement.

## Dépenses partagées

- **Dépense partagée** (`shared_expenses`) : copie, dans un espace commun, d'une dépense d'un espace personnel (libellé, montant, date, catégorie commune, payeur, répartition). La transaction source reste privée. ADR 0002.
- **Répartition** (`shares`) : pourcentage par utilisateur, somme 100, figée au moment du partage ; `default_share_percent` de l'espace (50 par défaut) n'est que la valeur de départ.
- **Solde entre membres** : dérivé, jamais stocké (`lib/shared-expenses/balance.ts`) ; calculé sur le montant brut, arrondi à la charge du payeur.
- **Règlement** (`settlements`) : « X a remboursé Y » (`from_user` → `to_user`), normalement lié à la transaction réellement reçue ; non modifiable (supprimer puis recréer). *À ne pas confondre avec* un remboursement lié.
