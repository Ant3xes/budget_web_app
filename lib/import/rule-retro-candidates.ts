import type { SupabaseClient } from "@supabase/supabase-js";

import { findMatchingRule } from "@/lib/import/apply-rules";
import { fetchAllPages } from "@/lib/shared-expenses/fetch-all-pages";

/** Same cap as an import: one application shares at most this many lines. */
export const RETRO_SHARE_LIMIT = 500;

export type RetroRule = {
  id: string;
  keyword: string;
  kind: "expense" | "income";
  priority: number;
  share_space_id: string | null;
  share_category_id: string | null;
  share_payer_percent: number | null;
};

export type RetroCandidate = {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
};

export type RetroTransactionRow = {
  id: string;
  date: string;
  description: string | null;
  amount_cents: number;
  // PostgREST embeds the 1-1 relation as an object (or an array), null when absent.
  shared_expenses: { id: string } | { id: string }[] | null;
};

const isAlreadyShared = (embedded: RetroTransactionRow["shared_expenses"]) =>
  Array.isArray(embedded) ? embedded.length > 0 : embedded != null;

/**
 * Lines the rule would share: not shared yet, and whose FIRST matching rule
 * (by priority, like an import) is the targeted one. `rules` must be sorted by
 * priority ASC. Rows come from a query that already excludes transfers,
 * incomes and deleted lines.
 */
export const selectRetroCandidates = (
  rules: RetroRule[],
  ruleId: string,
  rows: RetroTransactionRow[],
): RetroCandidate[] =>
  rows
    .filter((row) => !isAlreadyShared(row.shared_expenses))
    .filter((row) => findMatchingRule(rules, row.description ?? "", "expense")?.id === ruleId)
    .map((row) => ({
      id: row.id,
      date: row.date,
      description: row.description ?? "",
      amount_cents: row.amount_cents,
    }));

/**
 * Loads the personal-space expenses since `since` (YYYY-MM-DD) that the rule
 * `ruleId` would share. Sorted by date, newest first.
 */
export const fetchRetroCandidates = async (
  supabase: SupabaseClient,
  spaceId: string,
  ruleId: string,
  since: string,
): Promise<RetroCandidate[]> => {
  const { data: rules, error } = await supabase
    .from("csv_import_rules")
    .select("id, keyword, kind, priority, share_space_id, share_category_id, share_payer_percent")
    .eq("space_id", spaceId)
    .order("priority", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = await fetchAllPages<RetroTransactionRow>((from, to) =>
    supabase
      .from("transactions")
      .select("id, date, description, amount_cents, shared_expenses(id)")
      .eq("space_id", spaceId)
      .is("deleted_at", null)
      .eq("kind", "expense")
      .is("transfer_id", null)
      .lt("amount_cents", 0)
      .gte("date", since)
      .order("id")
      .range(from, to),
  );

  return selectRetroCandidates((rules ?? []) as RetroRule[], ruleId, rows).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );
};
