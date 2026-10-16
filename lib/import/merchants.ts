import merchantsData from "@/data/merchants.json";

export type MerchantKind = "expense" | "income";

export type Merchant = {
  /** Clean display name. */
  name: string;
  /** Bank-label fragments (case/accent-insensitive) that identify the merchant. */
  patterns: string[];
  /** `translation_key` of a default category. */
  category_key: string;
  kind: MerchantKind;
};

export type MerchantMatch = Pick<Merchant, "name" | "category_key" | "kind">;

/** Lower-case, strip accents, collapse spaces, glue "*" to its neighbours ("UBER   * EATS" -> "uber*eats"). */
export function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s*\*\s*/g, "*")
    .replace(/\s+/g, " ")
    .trim();
}

const isLetter = (ch: string | undefined) => !!ch && /\p{L}/u.test(ch);
const isAlnum = (ch: string | undefined) => !!ch && /[\p{L}\d]/u.test(ch);

/**
 * Pattern found in the label, bounded by non-letters on the left (so "bp" does
 * not match "bpifrance") and non-letters on the right (digits allowed: "google*ads79649").
 */
function containsPattern(label: string, pattern: string): boolean {
  let from = 0;
  for (;;) {
    const idx = label.indexOf(pattern, from);
    if (idx === -1) return false;
    const before = label[idx - 1];
    const after = label[idx + pattern.length];
    const leftOk = !isAlnum(pattern[0]) || !isAlnum(before);
    const rightOk = !isAlnum(pattern[pattern.length - 1]) || !isLetter(after);
    if (leftOk && rightOk) return true;
    from = idx + 1;
  }
}

type Entry = { pattern: string; merchant: Merchant };

function buildIndex(merchants: Merchant[]): Entry[] {
  return merchants
    .flatMap((merchant) =>
      merchant.patterns.map((p) => ({ pattern: normalizeForMatch(p), merchant })),
    )
    // Longest pattern first: the most specific one wins.
    .sort((a, b) => b.pattern.length - a.pattern.length);
}

export const merchants = merchantsData as Merchant[];
const index = buildIndex(merchants);

/** Resolves a raw bank label to a known merchant (issue 128), or null. */
export function matchMerchant(rawLabel: string): MerchantMatch | null {
  const label = normalizeForMatch(rawLabel);
  if (!label) return null;
  for (const { pattern, merchant } of index) {
    if (containsPattern(label, pattern)) {
      return { name: merchant.name, category_key: merchant.category_key, kind: merchant.kind };
    }
  }
  return null;
}
