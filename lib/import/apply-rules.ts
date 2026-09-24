import type { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Transfer detection
// Matches typical French bank transfer descriptions (BNP, N26, etc.)
// ---------------------------------------------------------------------------

const TRANSFER_KEYWORDS = [
  "virement",
  "vir inst",
  "vir sepa",
  "vir recu",
  "vir emis",
  "virt sepa",
  "transfer",
];

/**
 * Returns true if the description looks like a bank transfer between accounts.
 * Matches at start of string or after a space to avoid false positives.
 */
export function detectTransfer(description: string): boolean {
  const lower = description.toLowerCase();
  return TRANSFER_KEYWORDS.some((kw) => lower === kw || lower.startsWith(kw + " ") || lower.includes(" " + kw));
}

// ---------------------------------------------------------------------------
// Built-in keyword → category matching
// Keys are partial, case-insensitive fragments matched against the user's
// category names (e.g. "alimentat" matches "Alimentation", "alimentaire"…).
// Multiple categoryNames are tried in order; first match wins.
// ---------------------------------------------------------------------------

type DefaultCategoryRule = {
  keywords: string[];
  categoryNames: string[];
  kind: "expense" | "income";
};

export const DEFAULT_CATEGORY_KEYWORDS: DefaultCategoryRule[] = [
  // Alimentation / Courses
  {
    categoryNames: ["alimentat", "courses", "épicerie", "epicerie", "groceries", "nourriture"],
    keywords: [
      "carrefour", "leclerc", "lidl", "aldi", "intermarché", "intermarch",
      "monoprix", "franprix", "super u", "système u", "systeme u",
      "auchan", "casino", "picard", "biocoop", "naturalia", "grand frais",
      "g20", "simply market", "champion", "marché", "supermarché",
    ],
    kind: "expense",
  },
  // Restaurants / Repas hors foyer
  {
    categoryNames: ["restaurant", "repas", "resto", "fast food", "nourriture"],
    keywords: [
      "mcdonald", "burger king", "kfc", "quick", "pizza", "pizzeria",
      "restaurant", "brasserie", "bistrot", "sushi", "japonais",
      "traiteur", "kebab", "tacos", "five guys", "brioche doree",
      "paul boulangerie", "boulangerie", "pâtisserie",
    ],
    kind: "expense",
  },
  // Transport
  {
    categoryNames: ["transport", "déplacement", "deplacement", "mobilité", "mobilite"],
    keywords: [
      "sncf", "ratp", "navigo", "transilien", "tgv", "ter ",
      "uber", "bolt", "heetch", "taxi", "vtc",
      "blablacar", "ouigo", "trenitalia", "eurostar",
    ],
    kind: "expense",
  },
  // Carburant
  {
    categoryNames: ["carburant", "essence", "fuel", "énergie", "energie"],
    keywords: [
      "totalenergies", "total station", "bp station", "shell", "esso", "q8",
      "station service", "carburant",
    ],
    kind: "expense",
  },
  // Santé / Pharmacie
  {
    categoryNames: ["santé", "sante", "medical", "médical", "pharmacie", "mutuelle"],
    keywords: [
      "pharmacie", "parapharmacie", "doctolib", "médecin", "docteur",
      "dentiste", "opticien", "krys", "optical center", "clinique",
      "hôpital", "hopital", "laboratoire", "radiologue", "kiné",
    ],
    kind: "expense",
  },
  // Logement / Loyer
  {
    categoryNames: ["logement", "loyer", "habitat", "immobilier"],
    keywords: ["loyer", "charges locatives", "copropriété", "copropriet", "syndic"],
    kind: "expense",
  },
  // Énergie / Eau / Télécom
  {
    categoryNames: ["énergie", "energie", "électricité", "electricite", "gaz", "eau", "telecom", "téléphone", "internet", "abonnement"],
    keywords: [
      "edf", "engie", "veolia", "saur", "lyonnaise des eaux",
      "orange", "sfr", "free mobile", "bouygues", "sosh", "red by sfr",
    ],
    kind: "expense",
  },
  // Shopping / Vêtements
  {
    categoryNames: ["shopping", "vêtements", "vetements", "habillement", "mode"],
    keywords: [
      "amazon", "fnac", "darty", "ikea", "zara", "h&m", "h & m",
      "decathlon", "adidas", "nike", "uniqlo", "primark", "kiabi",
      "la redoute", "asos", "shein", "bershka", "pull and bear",
      "cdiscount", "boulanger",
    ],
    kind: "expense",
  },
  // Culture / Loisirs / Sport
  {
    categoryNames: ["loisirs", "culture", "divertissement", "entertainment", "sport", "abonnement"],
    keywords: [
      "netflix", "spotify", "disney", "canal+", "amazon prime",
      "apple tv", "apple music", "youtube premium", "deezer",
      "cinema", "cinéma", "ugc", "pathé", "gaumont", "mk2",
      "théâtre", "theatre", "musée", "concert",
    ],
    kind: "expense",
  },
  // Voyages / Hébergement
  {
    categoryNames: ["voyages", "voyage", "vacances", "hébergement", "hebergement", "hotel"],
    keywords: [
      "airbnb", "booking.com", "hotels.com", "expedia",
      "accor", "ibis", "novotel", "mercure",
      "air france", "easyjet", "ryanair", "transavia", "klm", "lufthansa",
      "aéroport", "aeroport",
    ],
    kind: "expense",
  },
  // Assurance
  {
    categoryNames: ["assurance"],
    keywords: [
      "axa", "maif", "macif", "allianz", "matmut", "groupama",
      "mma", "april", "ag2r", "harmonie mutuelle", "assurance",
    ],
    kind: "expense",
  },
  // Salaire / Revenus
  {
    categoryNames: ["salaire", "revenus", "revenu", "income", "rémunération", "remuneration"],
    keywords: ["salaire", "virement employeur", "traitement mensuel", "paie "],
    kind: "income",
  },
  // Remboursements
  {
    categoryNames: ["remboursement", "cpam", "sécurité sociale", "securite sociale"],
    keywords: ["cpam", "ameli", "cnam", "remb secu", "remboursement secu"],
    kind: "income",
  },
];

/**
 * Builds a fallback matcher based on built-in keyword lists.
 * For each default rule, it looks for a user category whose name contains
 * one of the rule's `categoryNames` fragments (case-insensitive partial match).
 * When a transaction description contains a keyword, the matched category is suggested.
 */
export function buildDefaultMatcher(
  categories: { id: string; name: string; kind: "expense" | "income" }[],
): (description: string, kind: "expense" | "income") => string | null {
  type ResolvedRule = { keywords: string[]; category_id: string; kind: "expense" | "income" };

  const resolved: ResolvedRule[] = [];

  for (const rule of DEFAULT_CATEGORY_KEYWORDS) {
    const cat = categories.find(
      (c) =>
        c.kind === rule.kind &&
        rule.categoryNames.some((n) => c.name.toLowerCase().includes(n.toLowerCase())),
    );
    if (!cat) continue;
    resolved.push({ keywords: rule.keywords, category_id: cat.id, kind: rule.kind });
  }

  return (description: string, kind: "expense" | "income"): string | null => {
    const lower = description.toLowerCase();
    for (const rule of resolved) {
      if (rule.kind !== kind) continue;
      if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
        return rule.category_id;
      }
    }
    return null;
  };
}

type CsvImportRule = {
  keyword: string;
  category_id: string;
  kind: "expense" | "income";
  priority: number;
};

/**
 * Loads the space's csv_import_rules and returns a function that
 * finds the best matching category_id for a given description + kind.
 * Rules are ordered by priority ASC (lowest = highest priority).
 * When multiple rules match, the one with the lowest priority value wins.
 */
export async function buildRuleMatcher(
  supabase: SupabaseClient,
  spaceId: string,
): Promise<(description: string, kind: "expense" | "income") => string | null> {
  const { data } = await supabase
    .from("csv_import_rules")
    .select("keyword, category_id, kind, priority")
    .eq("space_id", spaceId)
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

export type RuleShare = {
  space_id: string;
  category_id: string | null;
  payer_share_percent: number | null;
};

type CsvImportShareRule = {
  keyword: string;
  kind: "expense" | "income";
  priority: number;
  share_space_id: string | null;
  share_category_id: string | null;
  share_payer_percent: number | null;
};

/**
 * Same first-match-by-priority semantics as buildRuleMatcher, but returns the
 * sharing setting of the matching rule. A matching rule WITHOUT a share stops
 * the search and yields null (the rule the user sees applied wins).
 */
export async function buildRuleShareMatcher(
  supabase: SupabaseClient,
  spaceId: string,
): Promise<(description: string, kind: "expense" | "income") => RuleShare | null> {
  const { data } = await supabase
    .from("csv_import_rules")
    .select("keyword, kind, priority, share_space_id, share_category_id, share_payer_percent")
    .eq("space_id", spaceId)
    .order("priority", { ascending: true });

  const rules = (data ?? []) as CsvImportShareRule[];

  return (description, kind) => {
    const lower = description.toLowerCase();
    for (const rule of rules) {
      if (rule.kind === kind && lower.includes(rule.keyword.toLowerCase())) {
        return rule.share_space_id
          ? {
              space_id: rule.share_space_id,
              category_id: rule.share_category_id ?? null,
              payer_share_percent: rule.share_payer_percent ?? null,
            }
          : null;
      }
    }
    return null;
  };
}

/**
 * Builds a matcher from the space's past categorized transactions.
 * For each (description, kind) pair, picks the most frequently assigned category_id.
 * Matching is exact on description (case-insensitive).
 * Intended as a fallback when no import rule matches.
 */
export async function buildHistoryMatcher(
  supabase: SupabaseClient,
  spaceId: string,
): Promise<(description: string, kind: "expense" | "income") => string | null> {
  const { data } = await supabase
    .from("transactions")
    .select("description, kind, category_id")
    .eq("space_id", spaceId)
    .not("category_id", "is", null)
    .is("deleted_at", null);

  // frequency map: "description_lower|kind" → Map<category_id, count>
  const freqMap = new Map<string, Map<string, number>>();
  for (const row of (data ?? []) as { description: string; kind: string; category_id: string }[]) {
    if (!row.category_id) continue;
    const key = `${row.description.toLowerCase()}|${row.kind}`;
    const counts = freqMap.get(key) ?? new Map<string, number>();
    counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    freqMap.set(key, counts);
  }

  // best match: key → most frequent category_id
  const bestMatch = new Map<string, string>();
  for (const [key, counts] of freqMap) {
    let best = "";
    let bestCount = 0;
    for (const [catId, count] of counts) {
      if (count > bestCount) {
        best = catId;
        bestCount = count;
      }
    }
    if (best) bestMatch.set(key, best);
  }

  return (description: string, kind: "expense" | "income"): string | null => {
    const key = `${description.toLowerCase()}|${kind}`;
    return bestMatch.get(key) ?? null;
  };
}
