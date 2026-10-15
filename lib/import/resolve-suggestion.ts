import { matchMerchant, type MerchantMatch } from "@/lib/import/merchants";

export type SuggestionSource = "rule" | "history" | "merchant" | "default";

export type SuggestionKind = "expense" | "income";

export type SpaceCategory = {
  id: string;
  name: string;
  kind: SuggestionKind;
  translation_key?: string | null;
};

type Matcher = (description: string, kind: SuggestionKind) => string | null;

export type SuggestionMatchers = {
  rule: Matcher;
  history: Matcher;
  default: Matcher;
};

export type Suggestion = {
  category_id: string | null;
  source: SuggestionSource | null;
  /** Known merchant behind the label, even when the space has no matching category. */
  merchant: MerchantMatch | null;
};

/**
 * Resolves the category of the space for a merchant: same `translation_key`,
 * same kind as the line. A space without that category yields null (issue 130).
 */
export function resolveMerchantCategory(
  merchant: MerchantMatch,
  kind: SuggestionKind,
  categories: SpaceCategory[],
): string | null {
  if (merchant.kind !== kind) return null;
  return categories.find((c) => c.kind === kind && c.translation_key === merchant.category_key)?.id ?? null;
}

/**
 * Suggestion order (issue 130): personal rules > history > merchants database >
 * built-in keywords. Transfers and duplicates never get a suggestion; the
 * caller skips this function for them.
 */
export function resolveSuggestion(
  description: string,
  kind: SuggestionKind,
  matchers: SuggestionMatchers,
  categories: SpaceCategory[],
): Suggestion {
  const merchant = matchMerchant(description);

  const rule = matchers.rule(description, kind);
  if (rule) return { category_id: rule, source: "rule", merchant };

  const history = matchers.history(description, kind);
  if (history) return { category_id: history, source: "history", merchant };

  if (merchant) {
    const fromMerchant = resolveMerchantCategory(merchant, kind, categories);
    if (fromMerchant) return { category_id: fromMerchant, source: "merchant", merchant };
  }

  const fallback = matchers.default(description, kind);
  if (fallback) return { category_id: fallback, source: "default", merchant };

  return { category_id: null, source: null, merchant };
}
