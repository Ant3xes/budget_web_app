export type HistogramTx = { amount_cents: number };

export type HistogramBucket = {
  /** e.g. "10–25€", or "250€+" for the open-ended top bucket. */
  label: string;
  count: number;
};

// Cents — upper bound of each bucket, exclusive; the last bucket is open-ended.
const BUCKET_EDGES_CENTS = [1000, 2500, 5000, 10000, 25000] as const;

/**
 * Buckets expense amounts into fixed euro ranges for a distribution
 * histogram (issue #36 "Distribution des montants de transactions"). Fixed,
 * human-legible edges (10/25/50/100/250€) rather than an auto-binned
 * histogram — the point is "how many of my expenses are small vs large",
 * which reads more directly off round numbers than off a data-dependent
 * bin width that shifts as more transactions come in.
 */
export function computeAmountHistogram(transactions: HistogramTx[]): HistogramBucket[] {
  const counts = new Array<number>(BUCKET_EDGES_CENTS.length + 1).fill(0);

  for (const tx of transactions) {
    const amount = Math.abs(tx.amount_cents);
    const bucketIndex = BUCKET_EDGES_CENTS.findIndex((edge) => amount < edge);
    counts[bucketIndex === -1 ? BUCKET_EDGES_CENTS.length : bucketIndex]!++;
  }

  const labels = ["0–10€", "10–25€", "25–50€", "50–100€", "100–250€", "250€+"];
  return labels.map((label, i) => ({ label, count: counts[i]! }));
}
