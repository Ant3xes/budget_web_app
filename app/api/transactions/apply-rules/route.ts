import { NextResponse } from "next/server";
import { z } from "zod";

import { buildHistoryMatcher, buildRuleMatcher } from "@/lib/import/apply-rules";
import { insertImportRules } from "@/lib/import/rules";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const withUser = async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, user };
};

type RawTransaction = {
  id: string;
  description: string;
  kind: string;
};

type CategoryRow = {
  id: string;
  name: string;
  icon: string | null;
};

/**
 * GET /api/transactions/apply-rules
 * Returns a preview of uncategorized imported transactions and their suggested categories
 * based on import rules (priority) and history matching (fallback).
 */
export async function GET() {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;

  const [txResult, catResult, ruleMatcher, historyMatcher] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, description, kind")
      .eq("user_id", user.id)
      .is("category_id", null)
      .is("deleted_at", null)
      .in("kind", ["expense", "income"]),
    supabase
      .from("categories")
      .select("id, name, icon")
      .eq("user_id", user.id)
      .is("deleted_at", null),
    buildRuleMatcher(supabase, user.id),
    buildHistoryMatcher(supabase, user.id),
  ]);

  const transactions = (txResult.data ?? []) as RawTransaction[];
  const categoriesById = new Map<string, CategoryRow>(
    ((catResult.data ?? []) as CategoryRow[]).map((c) => [c.id, c]),
  );

  const previews: Array<{
    id: string;
    description: string;
    kind: "expense" | "income";
    suggested_category_id: string;
    suggestion_source: "rule" | "history";
    category_name: string;
    category_icon: string | null;
  }> = [];

  // Transactions with neither a rule nor a history match — exposed so the UI
  // can offer manual categorization (and optionally save a new rule from it),
  // instead of leaving the user with nothing actionable.
  const unmatched: Array<{ id: string; description: string; kind: "expense" | "income" }> = [];

  for (const tx of transactions) {
    const kind = tx.kind as "expense" | "income";
    const ruleMatch = ruleMatcher(tx.description, kind);
    const historyMatch = ruleMatch === null ? historyMatcher(tx.description, kind) : null;
    const suggestedId = ruleMatch ?? historyMatch;
    if (!suggestedId) {
      if (unmatched.length < 500) unmatched.push({ id: tx.id, description: tx.description, kind });
      continue;
    }

    const cat = categoriesById.get(suggestedId);
    if (!cat) continue;

    previews.push({
      id: tx.id,
      description: tx.description,
      kind,
      suggested_category_id: suggestedId,
      suggestion_source: ruleMatch !== null ? "rule" : "history",
      category_name: cat.name,
      category_icon: cat.icon,
    });
  }

  const unmatchedCount = transactions.length - previews.length;

  return NextResponse.json({ previews, unmatched, unmatched_count: unmatchedCount });
}

const applyRulesSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().uuid(),
        category_id: z.string().uuid(),
      }),
    )
    .min(1)
    .max(500),
  // Rules to create from transactions the user just categorized manually —
  // "Catégoriser" then remembers the choice for the next import (see
  // ApplyRulesModal's "unmatched" section).
  new_rules: z
    .array(
      z.object({
        keyword: z.string().trim().min(1).max(200),
        category_id: z.string().uuid(),
        kind: z.enum(["expense", "income"]),
      }),
    )
    .max(500)
    .optional(),
});

/**
 * POST /api/transactions/apply-rules
 * Applies category assignments to uncategorized transactions, and optionally
 * creates new csv_import_rules from the ones chosen manually.
 * Body: { updates: Array<{ id, category_id }>, new_rules?: Array<{ keyword, category_id, kind }> }
 */
export async function POST(request: Request) {
  const auth = await withUser();
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;

  const payload = applyRulesSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json(
      { error: payload.error.issues[0]?.message ?? "Données invalides" },
      { status: 400 },
    );
  }

  const { updates, new_rules } = payload.data;
  let applied = 0;

  // Apply each update individually to ensure RLS (user_id check) is respected
  const results = await Promise.all(
    updates.map(({ id, category_id }) =>
      supabase
        .from("transactions")
        .update({ category_id })
        .eq("id", id)
        .eq("user_id", user.id)
        .is("category_id", null)
        .is("deleted_at", null),
    ),
  );

  for (const result of results) {
    if (!result.error) applied++;
  }

  let rulesCreated = 0;
  if (new_rules && new_rules.length > 0) {
    const result = await insertImportRules(supabase, user.id, new_rules);
    rulesCreated = result.inserted;
  }

  return NextResponse.json({ applied, rules_created: rulesCreated });
}
