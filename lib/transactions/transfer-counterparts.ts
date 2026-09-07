import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Batch-fetches the counterpart account (the transfer_credit side) for a set
 * of transfer_id values, keyed by transfer_id. Shared between
 * GET /api/transactions and GET /api/transfers — both list `transfer_debit`
 * rows as the representative row of a transfer pair and need to attach the
 * destination account for display.
 */
export async function fetchTransferCounterparts(
  supabase: SupabaseClient,
  userId: string,
  transferIds: string[],
): Promise<Record<string, { name: string } | null>> {
  if (transferIds.length === 0) return {};

  const { data } = await supabase
    .from("transactions")
    .select("transfer_id, accounts(name)")
    .eq("user_id", userId)
    .eq("kind", "transfer_credit")
    .is("deleted_at", null)
    .in("transfer_id", transferIds);

  return Object.fromEntries(
    (data ?? []).map((c) => {
      // Supabase's generated types sometimes infer this embed as an array
      // even for a to-one relation — normalize defensively either way.
      const acc = Array.isArray(c.accounts) ? (c.accounts[0] ?? null) : c.accounts;
      return [c.transfer_id as string, acc as { name: string } | null];
    }),
  );
}
