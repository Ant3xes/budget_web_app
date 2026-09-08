// Fixed categorical palette (dataviz skill: assign hues in fixed order, never
// cycled per-render) — shared by every widget that colors things by bank
// name: the dashboard's `BankBubbles` and analytics's
// `AccountBalanceBreakdownChart` both used to carry their own byte-identical
// copy of this array and hash function; extracted here so the two views
// can't silently drift apart on which color represents a given bank.
const BANK_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)",
  "var(--chart-5)", "var(--chart-6)", "var(--chart-7)", "var(--chart-8)",
];

/**
 * Deterministic slot from the bank's own name rather than its position in a
 * sorted list — grouping helpers like `groupAccountBalancesByBank` sort
 * alphabetically, so adding or removing an unrelated bank would otherwise
 * shift every alphabetically later bank to a different index, changing its
 * color even though that bank itself hasn't changed. A simple string hash
 * trades a small, bounded chance of two bank names sharing a slot (already
 * possible once there are more than 8 banks) for a color that stays fixed
 * for a given bank across page loads and across every consumer of this
 * function.
 */
export function colorForBank(bankLabel: string): string {
  let hash = 0;
  for (let i = 0; i < bankLabel.length; i++) hash = (hash * 31 + bankLabel.charCodeAt(i)) | 0;
  return BANK_COLORS[Math.abs(hash) % BANK_COLORS.length]!;
}
