import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

import { fetchAllPages } from "@/lib/shared-expenses/fetch-all-pages";
import { buildReimbursementIndex, type ReimbursementIndex } from "@/lib/transactions/net-amount";

/**
 * Every active reimbursement link of a space (ADR 0004). Deliberately NOT bound
 * to the page's date window or account filter: a refund received next month
 * still lowers the original expense, and a refund on another account still stops
 * counting as income. Links are few, so one exhaustive read is cheap.
 */
export async function fetchReimbursementIndex(supabase: SupabaseClient<Database>, spaceId: string): Promise<ReimbursementIndex> {
  const rows = await fetchAllPages<{ id: string; amount_cents: number; reimburses_transaction_id: string | null }>(
    (from, to) =>
      supabase
        .from("transactions")
        .select("id, amount_cents, reimburses_transaction_id")
        .eq("space_id", spaceId)
        .not("reimburses_transaction_id", "is", null)
        .is("deleted_at", null)
        .order("id")
        .range(from, to),
  );
  return buildReimbursementIndex(
    rows.flatMap((r) =>
      r.reimburses_transaction_id
        ? [{ id: r.id, expenseId: r.reimburses_transaction_id, amount_cents: Number(r.amount_cents) }]
        : [],
    ),
  );
}
