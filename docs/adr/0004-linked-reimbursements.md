# 0004 — Remboursements liés à une dépense (montant net)

Status: accepted (implémenté dans l'issue 123)

## Contexte

Un cadeau de 90 € dont 60 € sont ensuite remboursés par deux personnes a coûté
30 € à l'utilisateur. Jusqu'ici les 90 € comptaient en dépense et les 60 € en
revenu : dépenses et revenus du mois étaient gonflés d'autant, et le budget de
la catégorie consommé à tort.

## Décision

### Modèle

- Colonne `transactions.reimburses_transaction_id uuid` (nullable, FK vers
  `transactions(id)`, index partiel). La **source** (le remboursement) pointe
  vers la **cible** (la dépense).
- Une transaction **entrante** (`income` ou `transfer_credit`, montant > 0) peut
  rembourser **une seule** dépense. Une dépense peut avoir **plusieurs**
  remboursements.
- Contraintes en base : pas d'auto-référence et source entrante positive
  (`check`) ; la cible est une dépense (`kind = 'expense'`, montant < 0, non
  supprimée) **du même espace** (trigger, car un `check` ne voit pas une autre
  ligne). La RLS ne change pas.

### Montant net

```
net = max(0, |dépense| − somme(remboursements liés non supprimés))
```

Le net est **plafonné à 0** : un remboursement supérieur à la dépense ne crée
pas de dépense négative. Le surplus n'est pas recompté en revenu (le lien
l'exclut des revenus) : choix assumé et simple, l'utilisateur peut délier ou
ajuster le montant.

Une seule fonction pure, `lib/transactions/net-amount.ts`, porte la règle
(`netExpenseCents`, `sumReimbursements`, `applyReimbursements`). Tout calcul de
dépenses/revenus passe par elle.

### Effets sur chaque calcul

- **Dépenses** (listes, KPI, camembert, tendances, budgets, analyse, histogramme,
  jours de semaine, comparaison annuelle) : la dépense compte pour son **net**.
  Une dépense intégralement remboursée (net 0) sort des agrégats : elle ne
  compte ni en somme ni en nombre (histogramme, marchands récurrents).
- **Revenus** : un remboursement lié ne compte **plus** comme revenu
  (dashboard, analyse, comparaison annuelle, détail du compte).
- **Soldes : inchangés.** L'argent réel est entré sur le compte. Soldes de
  comptes, courbes, patrimoine net, « Épargne ce mois », reste-à-vivre et
  progression des objectifs continuent de sommer `amount_cents` brut.
- **Agrégats SQL de l'issue 121** (`analytics_account_monthly_deltas`,
  `analytics_account_balances`, `analytics_goal_category_monthly`) : ce sont des
  soldes et un snapshot d'objectifs, donc **volontairement inchangés** (aucune
  nouvelle fonction SQL d'agrégat). Si une fonction SQL d'agrégat de
  dépenses/revenus apparaît un jour, elle devra appliquer la même règle.
- **Période** : la dépense compte à sa date, **net de tous ses remboursements,
  même datés d'un autre mois** (un remboursement reçu le mois suivant réduit la
  dépense du mois d'origine). Les totaux de remboursements sont donc lus sans
  fenêtre de dates (`lib/transactions/fetch-reimbursements.ts`).
- **Dépenses partagées (ADR 0002)** : les co-membres ne peuvent pas lire la
  transaction source ni ses remboursements (RLS). La copie `shared_expenses`
  porte donc `reimbursed_cents`, tenu à jour par un trigger `security definer`,
  et les lignes d'activité partagées (dashboard, analyse, consommation de
  budget) comptent `max(0, amount_cents − reimbursed_cents)`. En revanche la
  **dette entre membres** (`computeBalances`, règlements) reste calculée sur le
  montant **brut** : on ne réécrit pas silencieusement ce que les membres se
  doivent ; un remboursement reçu d'un tiers se règle comme aujourd'hui.

### Suppression logique et changement de type

Un lien n'a d'effet que si la source ET la cible sont des lignes actives du bon
type. Plutôt que de laisser les lectures « ignorer » des liens orphelins (et de
dupliquer le filtre partout), la base **nettoie** le lien, quel que soit le
chemin d'écriture (PATCH, `convert_transaction`, suppression, import) :

- Trigger `BEFORE UPDATE` sur la source : si elle est supprimée, n'est plus
  entrante ou n'est plus positive, son `reimburses_transaction_id` passe à
  `null`. Il s'exécute avant le `check`, donc `convert_transaction` (migration
  20261016100000, non modifiée) reste valide.
- Trigger `AFTER UPDATE` sur la cible : si elle est supprimée ou cesse d'être une
  dépense (virement, revenu, montant ≥ 0), tous les liens qui pointent vers elle
  sont mis à `null`. Les remboursements redeviennent alors des revenus normaux.
- Supprimer un remboursement le retire du net de la dépense (il est exclu des
  sommes par `deleted_at`, et son lien est nettoyé).

Les lectures filtrent quand même `deleted_at is null` sur les sources.

### Interface

- Modale d'une dépense : section « Remboursements » (liens existants, ajout d'une
  entrée récente non liée, retrait d'un lien).
- Modale d'une entrée : « Rembourse la dépense… » (choix parmi les dépenses
  récentes, ou retrait du lien).
- Liste : montant net avec la mention « 30 € sur 90 € ».
- API : `PUT/DELETE /api/transactions/[id]/reimburses` pose ou retire le lien ;
  `GET /api/transactions/reimbursement-candidates` liste les candidats.

## Conséquences

- Toute nouvelle somme de dépenses/revenus doit passer par
  `applyReimbursements` (lignes + totaux de `fetchReimbursedTotals`), et ne
  jamais l'appliquer à un solde.
- Les lignes existantes n'ont aucun lien : comportement strictement inchangé.
- Non couvert : lier un remboursement à plusieurs dépenses (un remboursement =
  une dépense), répartir un remboursement partiel entre dépenses.
- Les tests pgTAP ne sont pas exécutés ici (pas de Docker) ; la logique de
  calcul est couverte par des tests unitaires.
