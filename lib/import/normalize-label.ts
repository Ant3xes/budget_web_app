export type LabelSource = "bnp" | "n26";

export type NormalizedLabel = {
  /** Readable label shown in the app (becomes `transactions.description`). */
  clean: string;
  /** The bank label exactly as read from the file (kept in `raw_import_data.raw_label`). */
  raw: string;
};

/** Short all-caps words that stay upper-case (they are acronyms, not shouting). */
const ACRONYMS = new Set([
  "SNCF", "RATP", "EDF", "SFR", "CAF", "URSSAF", "CPAM", "BNP", "TCL", "RTE", "SEPA", "SAS", "SARL",
  "TV", "DVD", "USB", "ATM", "FR", "EU", "UK", "USA", "IKEA", "KFC", "BP", "PMU", "FNAC", "GRDF", "MAIF", "MACIF",
]);

const DATE = String.raw`\d{1,2}\/\d{1,2}(?:\/\d{2,4})?`;

/** BNP card/direct-debit noise: prefixes, "DU jj/mm/aa [A ville]", "CARTE*nnnn", "(PAYS)", SEPA mentions. */
function stripBnp(label: string): string {
  return label
    .replace(/\s*[-–]?\s*\b(?:EMETTEUR|MOTIF|REF)\s*:.*$/i, "")
    .replace(/^\s*(?:PAIEMENT\s+CB|PRELEVEMENT(?:\s+(?:SEPA|EUROPEEN))?|PRLV(?:\s+SEPA)?)\s+/i, "")
    .replace(/\s*[-–]?\s*CARTE\s*\*\s*\w+/gi, "")
    .replace(new RegExp(String.raw`\s+DU\s+${DATE}(?:\s+A\s+[^()]*?)?(?=\s*\(|\s+[-–](?:\s|$)|\s*$)`, "i"), "")
    .replace(/\s*\([^)]*\)/g, "");
}

/** Identifier suffixes and processor noise, seen on N26 (and sometimes BNP) card payments. */
function stripIdentifiers(label: string): string {
  return label
    .replace(/\s*\*\s*(?=[A-Z0-9]*\d)[A-Z0-9]{5,}\s*$/i, "")
    .replace(/\bPENDING\b\.?/gi, "")
    .replace(/\*+/g, " ");
}

function titleWord(word: string): string {
  // A word that already has lower-case letters was written by a human: keep it.
  if (/\p{Ll}/u.test(word)) return word;
  // Domain names are lower-cased ("EXEMPLE.COM" -> "exemple.com").
  if (/^[\p{L}\d-]+(\.[\p{L}\d-]+)+$/u.test(word)) return word.toLowerCase();
  const letters = word.replace(/[^\p{L}]/gu, "");
  if (ACRONYMS.has(letters)) return word;
  // No vowel in a short word: a sigle rather than a name (SNCF, RTE...).
  if (letters.length >= 2 && letters.length <= 4 && !/[AEIOUYÀÂÉÈÊËÎÏÔÙÛ]/u.test(letters)) return word;
  return word.replace(/\p{L}+/gu, (part) => part.charAt(0) + part.slice(1).toLowerCase());
}

const titleCase = (label: string) => label.split(" ").map(titleWord).join(" ");

/**
 * Turns a bank label into a readable one. Pure: the raw label is returned
 * untouched next to the clean one. A label that would be emptied by the
 * cleaning keeps its raw text.
 */
export function normalizeLabel(raw: string, { source }: { source: LabelSource }): NormalizedLabel {
  let label = raw;
  if (source === "bnp") label = stripBnp(label);
  label = stripIdentifiers(label)
    .replace(/(?:\s*[-–])+\s*$/, "")
    .replace(/^\s*[-–]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  const clean = label ? titleCase(label) : "";
  return { clean: clean || raw.trim(), raw };
}
