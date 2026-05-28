import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ParsedTransaction } from "./parse-n26";

/**
 * Builds a stable hash for deduplication: SHA-256 of "date|description|amount_cents".
 */
export function buildHash(tx: Pick<ParsedTransaction, "date" | "description" | "amount_cents">): string {
  return createHash("sha256")
    .update(`${tx.date}|${tx.description}|${tx.amount_cents}`)
    .digest("hex");
}

/**
 * Given a list of parsed transactions (with their hashes), returns the set of
 * hashes that already exist in the DB for this user.
 * The raw_import_data column is expected to store { hash: "..." }.
 */
export async function findExistingHashes(
  supabase: SupabaseClient,
  userId: string,
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();

  // We store the hash inside raw_import_data->>'hash'
  // Use a filter on the jsonb column
  const existing = new Set<string>();

  // Supabase doesn't support jsonb containment filter via the JS client directly,
  // so we query all imported transactions for this user and filter client-side.
  // For large datasets this could be optimised with a DB-side hash column — phase 4 concern.
  const { data } = await supabase
    .from("transactions")
    .select("raw_import_data")
    .eq("user_id", userId)
    .eq("is_imported", true)
    .is("deleted_at", null)
    .not("raw_import_data", "is", null);

  for (const row of data ?? []) {
    const h = (row.raw_import_data as { hash?: string } | null)?.hash;
    if (h && hashes.includes(h)) {
      existing.add(h);
    }
  }

  return existing;
}
