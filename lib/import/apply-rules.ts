import type { SupabaseClient } from "@supabase/supabase-js";

type CsvImportRule = {
  keyword: string;
  category_id: string;
  kind: "expense" | "income";
  priority: number;
};

/**
 * Loads the user's csv_import_rules and returns a function that
 * finds the best matching category_id for a given description + kind.
 * Rules are ordered by priority ASC (lowest = highest priority).
 * When multiple rules match, the one with the lowest priority value wins.
 */
export async function buildRuleMatcher(
  supabase: SupabaseClient,
  userId: string,
): Promise<(description: string, kind: "expense" | "income") => string | null> {
  const { data } = await supabase
    .from("csv_import_rules")
    .select("keyword, category_id, kind, priority")
    .eq("user_id", userId)
    .order("priority", { ascending: true });

  const rules: CsvImportRule[] = (data ?? []) as CsvImportRule[];

  return (description: string, kind: "expense" | "income"): string | null => {
    const lower = description.toLowerCase();
    for (const rule of rules) {
      if (rule.kind === kind && lower.includes(rule.keyword.toLowerCase())) {
        return rule.category_id;
      }
    }
    return null;
  };
}
