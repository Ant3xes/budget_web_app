export interface GoalForCurrentAmount {
  linked_category_id: string | null;
  current_amount_cents: number;
}

/**
 * A goal linked to a category tracks its progress live from that category's
 * transactions instead of the stored `current_amount_cents` — shared by
 * app/api/savings-goals/route.ts (GET) and the dashboard's savings-goals
 * summary widget (plan §Étape 3). Each caller fetches `categoryTotals`
 * itself (a Supabase query, so not part of this pure function); this
 * extracts the one-line resolution rule that was previously duplicated
 * between the two.
 */
export function resolveGoalCurrentCents(
  goal: GoalForCurrentAmount,
  categoryTotals: Record<string, number>,
): number {
  return goal.linked_category_id ? (categoryTotals[goal.linked_category_id] ?? 0) : goal.current_amount_cents;
}
