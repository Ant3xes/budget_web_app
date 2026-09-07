import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Computes the next csv_import_rule priority for a user (max existing + 1,
 * or 0 if they have none) — shared by insertImportRule below and
 * app/api/import-rules/route.ts's POST, so the two places that create a
 * csv_import_rule can't drift on how priority is assigned. Callers should
 * treat this as read-then-write (no DB-level locking): running it
 * concurrently for the same user can hand out the same priority twice, so
 * callers that create several rules in one request should await them
 * sequentially rather than via Promise.all.
 */
export async function nextRulePriority(supabase: SupabaseClient, userId: string): Promise<number> {
  const { data: maxData } = await supabase
    .from("csv_import_rules")
    .select("priority")
    .eq("user_id", userId)
    .order("priority", { ascending: false })
    .limit(1)
    .maybeSingle();

  return maxData ? (maxData.priority as number) + 1 : 0;
}

/**
 * Inserts several new csv_import_rules for the user in one batch — used by
 * app/api/transactions/apply-rules/route.ts, where the "categorize" flow can
 * create a rule from each of several transactions the user just categorized
 * manually in the same submission.
 *
 * Fetches the user's existing rules once (instead of once per new rule),
 * dedupes in memory — skipping a candidate whose keyword (case-insensitive)
 * and kind already exists, either in the user's saved rules or earlier in
 * this same batch — assigns priorities sequentially off a single starting
 * value, and issues one INSERT for everything that survives. This also
 * closes the race a per-row read-then-write would have: two candidates in
 * the same batch that share a keyword can no longer both pass the dedupe
 * check or collide on priority, since there's no await between checking and
 * reserving each one.
 *
 * Unlike the plain "add a rule" flow in app/api/import-rules/route.ts's
 * POST, this skips near-duplicates on purpose — "categorize" runs against a
 * whole batch of transactions at once, so it needs to avoid piling up
 * near-duplicate rules on its own; manually adding one rule at a time from
 * Settings doesn't have that problem, so that endpoint (still using
 * nextRulePriority above) is left free to accept an intentional near-dupe.
 */
export async function insertImportRules(
  supabase: SupabaseClient,
  userId: string,
  rules: Array<{ keyword: string; category_id: string; kind: "expense" | "income" }>,
): Promise<{ inserted: number }> {
  if (rules.length === 0) return { inserted: 0 };

  const { data: existing } = await supabase
    .from("csv_import_rules")
    .select("keyword, kind, priority")
    .eq("user_id", userId);

  const existingRows = (existing ?? []) as { keyword: string; kind: string; priority: number }[];
  const seen = new Set(existingRows.map((r) => `${r.kind}|${r.keyword.trim().toLowerCase()}`));
  let priority = existingRows.length > 0 ? Math.max(...existingRows.map((r) => r.priority)) + 1 : 0;

  const toInsert: { keyword: string; category_id: string; kind: "expense" | "income"; user_id: string; priority: number }[] = [];
  for (const rule of rules) {
    const keyword = rule.keyword.trim();
    if (!keyword) continue;
    const dedupeKey = `${rule.kind}|${keyword.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    toInsert.push({ keyword, category_id: rule.category_id, kind: rule.kind, user_id: userId, priority: priority++ });
  }

  if (toInsert.length === 0) return { inserted: 0 };

  const { error } = await supabase.from("csv_import_rules").insert(toInsert);
  if (error) return { inserted: 0 };
  return { inserted: toInsert.length };
}
