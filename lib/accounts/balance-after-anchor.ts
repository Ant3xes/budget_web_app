/**
 * Règle unique du solde d'un compte (issue 104, ADR 0003) :
 *
 *   solde = initial_balance_cents
 *         + somme(amount_cents des transactions non supprimées dont date > date d'ancrage)
 *
 * Les opérations datées ≤ ancrage restent visibles partout mais n'entrent pas
 * dans le solde. À utiliser partout où un solde est calculé.
 */

/** Ancrage des comptes existants avant la migration : toutes leurs opérations comptent. */
export const LEGACY_BALANCE_ANCHOR_DATE = "1900-01-01";

type AnchorTx = {
  date: string; // YYYY-MM-DD ou timestamp ISO
  amount_cents: number;
  deleted_at?: string | null;
};

/** Vrai si une opération datée `txDate` entre dans le solde (strictement après l'ancrage). */
export function isCountedInBalance(txDate: string, anchorDate: string): boolean {
  return txDate.slice(0, 10) > anchorDate.slice(0, 10);
}

/** Solde d'un compte : solde initial + opérations non supprimées postérieures à l'ancrage. */
export function balanceAfterAnchor(initialBalanceCents: number, anchorDate: string, transactions: AnchorTx[]): number {
  let sum = Number(initialBalanceCents);
  for (const tx of transactions) {
    if (tx.deleted_at) continue;
    if (isCountedInBalance(tx.date, anchorDate)) sum += Number(tx.amount_cents);
  }
  return sum;
}

/**
 * Vues multi-comptes : ne garde que les transactions qui comptent dans le solde
 * de LEUR compte (ancrage propre à chaque compte). Un compte absent de la map
 * garde toutes ses transactions.
 */
export function filterTransactionsAfterAnchor<T extends { account_id: string; date: string }>(
  transactions: T[],
  anchorByAccountId: ReadonlyMap<string, string>,
): T[] {
  return transactions.filter((tx) => {
    const anchor = anchorByAccountId.get(tx.account_id);
    return anchor === undefined || isCountedInBalance(tx.date, anchor);
  });
}
