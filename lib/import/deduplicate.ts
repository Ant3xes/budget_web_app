import { createHash } from "crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchAllPages } from "@/lib/shared-expenses/fetch-all-pages";

import type { ParsedTransaction } from "./parse-n26";

/**
 * Builds a stable hash for deduplication: SHA-256 of "date|description|amount_cents".
 *
 * `occurrence` tells apart genuinely identical lines of one file (two coffees at
 * the same price the same day): the first one (0) keeps the historical hash, so
 * everything imported before stays recognised; the following ones get a "#n"
 * suffix.
 */
export function buildHash(
  tx: Pick<ParsedTransaction, "date" | "description" | "amount_cents">,
  occurrence = 0,
): string {
  const suffix = occurrence > 0 ? `|#${occurrence}` : "";
  return createHash("sha256")
    .update(`${tx.date}|${tx.description}|${tx.amount_cents}${suffix}`)
    .digest("hex");
}

/**
 * Hashes a whole file: identical lines get increasing occurrence numbers, so a
 * file never contains the same hash twice.
 */
export function buildFileHashes(
  txs: Pick<ParsedTransaction, "date" | "description" | "amount_cents">[],
): string[] {
  const seen = new Map<string, number>();
  return txs.map((tx) => {
    const base = buildHash(tx);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return occurrence === 0 ? base : buildHash(tx, occurrence);
  });
}

/** A `timestamptz` read back from the DB ("2026-01-05T00:00:00+00:00") → "2026-01-05". */
const toDay = (date: string) => date.slice(0, 10);

/**
 * Given a list of parsed transactions (with their hashes), returns the set of
 * hashes that already exist in the DB in this space — or only in `accountId`
 * when given: the same line on two different bank accounts is not a duplicate.
 * Checks both:
 *   1. Previously imported transactions via their stored hash (raw_import_data->>'hash')
 *   2. All transactions (manual + mirror) by computing date|description|amount_cents hash
 *
 * Both queries are read page by page: PostgREST caps a response at 1000 rows,
 * so an unpaged read silently misses every hash past the first thousand.
 */
export async function findExistingHashes(
  supabase: SupabaseClient,
  spaceId: string,
  hashes: string[],
  accountId?: string | null,
): Promise<Set<string>> {
  if (hashes.length === 0) return new Set();

  const hashSet = new Set(hashes);
  const existing = new Set<string>();

  const [importedRows, otherRows] = await Promise.all([
    // 1. Imported transactions: match by stored hash in raw_import_data
    fetchAllPages<{ raw_import_data: unknown }>((from, to) => {
      let query = supabase
        .from("transactions")
        .select("raw_import_data")
        .eq("space_id", spaceId)
        .eq("is_imported", true)
        .is("deleted_at", null)
        .not("raw_import_data", "is", null);
      if (accountId) query = query.eq("account_id", accountId);
      return query.order("id").range(from, to);
    }),

    // 2. All transactions (manual, mirrors, etc.): compute hash client-side
    fetchAllPages<{ date: string; description: string; amount_cents: number }>((from, to) => {
      let query = supabase
        .from("transactions")
        .select("date, description, amount_cents")
        .eq("space_id", spaceId)
        .eq("is_imported", false)
        .is("deleted_at", null);
      if (accountId) query = query.eq("account_id", accountId);
      return query.order("id").range(from, to);
    }),
  ]);

  for (const row of importedRows) {
    const h = (row.raw_import_data as { hash?: string } | null)?.hash;
    if (h && hashSet.has(h)) existing.add(h);
  }

  for (const row of otherRows) {
    const h = buildHash({
      date: toDay(row.date),
      description: row.description,
      amount_cents: row.amount_cents,
    });
    if (hashSet.has(h)) existing.add(h);
  }

  return existing;
}

/** Bank booking dates of the two sides of a transfer can differ by a few days. */
export const MIRROR_DATE_TOLERANCE_DAYS = 3;

const DAY_MS = 86_400_000;
const dayNumber = (day: string) => Math.floor(Date.parse(`${toDay(day)}T00:00:00Z`) / DAY_MS);
const dayString = (n: number) => new Date(n * DAY_MS).toISOString().slice(0, 10);

/**
 * A transfer imported from the other bank with a counterpart account already
 * created its mirror line in `accountId`. Importing this account's own file
 * would then record the same money movement a second time.
 *
 * Returns the indexes of `lines` that match such a mirror (opposite side of the
 * transfer: same amount as the mirror, a few days apart at most). A mirror
 * absorbs a single line — the closest one — so two genuine transfers of the same
 * amount are not both swallowed by one mirror.
 */
export async function findTransferMirrorMatches(
  supabase: SupabaseClient,
  spaceId: string,
  accountId: string,
  lines: { date: string; amount_cents: number }[],
): Promise<Set<number>> {
  const matched = new Set<number>();
  if (lines.length === 0) return matched;

  const days = lines.map((line) => dayNumber(line.date));
  const first = dayString(Math.min(...days) - MIRROR_DATE_TOLERANCE_DAYS);
  const beforeLast = dayString(Math.max(...days) + MIRROR_DATE_TOLERANCE_DAYS + 1);

  const mirrors = await fetchAllPages<{ id: string; date: string; amount_cents: number }>((from, to) =>
    supabase
      .from("transactions")
      .select("id, date, amount_cents")
      .eq("space_id", spaceId)
      .eq("account_id", accountId)
      .eq("is_imported", false)
      .not("transfer_id", "is", null)
      .is("deleted_at", null)
      .gte("date", first)
      .lt("date", beforeLast)
      .order("id")
      .range(from, to),
  );
  if (mirrors.length === 0) return matched;

  // Every (line, mirror) pair that could be the two sides of one transfer,
  // closest dates first, each mirror and each line used once.
  const pairs: { line: number; mirror: number; gap: number }[] = [];
  mirrors.forEach((mirror, mirrorIndex) => {
    const mirrorDay = dayNumber(mirror.date);
    lines.forEach((line, lineIndex) => {
      const gap = Math.abs(mirrorDay - days[lineIndex]!);
      if (line.amount_cents === mirror.amount_cents && gap <= MIRROR_DATE_TOLERANCE_DAYS) {
        pairs.push({ line: lineIndex, mirror: mirrorIndex, gap });
      }
    });
  });
  pairs.sort((x, y) => x.gap - y.gap || x.line - y.line || x.mirror - y.mirror);

  const usedMirrors = new Set<number>();
  for (const pair of pairs) {
    if (matched.has(pair.line) || usedMirrors.has(pair.mirror)) continue;
    matched.add(pair.line);
    usedMirrors.add(pair.mirror);
  }
  return matched;
}
