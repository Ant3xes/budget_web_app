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
 * Checks both:
 *   1. Previously imported transactions via their stored hash (raw_import_data->>'hash')
 *   2. All transactions (manual + mirror) by computing date|description|amount_cents hash
 */
export async function findExistingHashes(
  supabase: SupabaseClient,
  userId: string,
  hashes: string[],
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();

  const hashSet = new Set(hashes);
  const existing = new Set<string>();

  // Run both queries in parallel
  const [importedRes, allRes] = await Promise.all([
    // 1. Imported transactions: match by stored hash in raw_import_data
    supabase
      .from("transactions")
      .select("raw_import_data")
      .eq("user_id", userId)
      .eq("is_imported", true)
      .is("deleted_at", null)
      .not("raw_import_data", "is", null),

    // 2. All transactions (manual, mirrors, etc.): compute hash client-side
    supabase
      .from("transactions")
      .select("date, description, amount_cents")
      .eq("user_id", userId)
      .eq("is_imported", false)
      .is("deleted_at", null),
  ]);

  for (const row of importedRes.data ?? []) {
    const h = (row.raw_import_data as { hash?: string } | null)?.hash;
    if (h && hashSet.has(h)) existing.add(h);
  }

  for (const row of allRes.data ?? []) {
    const h = buildHash({
      date: row.date as string,
      description: row.description as string,
      amount_cents: row.amount_cents as number,
    });
    if (hashSet.has(h)) existing.add(h);
  }

  return existing;
}
