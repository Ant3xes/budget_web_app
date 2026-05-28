import { NextResponse } from "next/server";
import { z } from "zod";

import { buildHistoryMatcher, buildRuleMatcher } from "@/lib/import/apply-rules";
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

  for (const tx of transactions) {
    const kind = tx.kind as "expense" | "income";
    const ruleMatch = ruleMatcher(tx.description, kind);
    const historyMatch = ruleMatch === null ? historyMatcher(tx.description, kind) : null;
    const suggestedId = ruleMatch ?? historyMatch;
    if (!suggestedId) continue;

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

  return NextResponse.json({ previews, unmatched_count: unmatchedCount });
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
});

/**
 * POST /api/transactions/apply-rules
 * Applies category assignments to uncategorized transactions.
 * Body: { updates: Array<{ id: string, category_id: string }> }
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

  const { updates } = payload.data;
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

  return NextResponse.json({ applied });
}
