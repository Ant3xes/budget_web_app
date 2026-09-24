/**
 * Parses a bank amount into a float, whatever the number format of the export:
 * "-1 234,56" (space thousands, decimal comma), "1.234,56" (dot thousands),
 * "1,234.56" (comma thousands, decimal dot), "-15.99".
 *
 * When both separators appear, the last one is the decimal mark. A lone comma
 * is a decimal comma; several dots of the same kind are thousands separators.
 * Returns NaN when the text is not a number.
 */
export function parseAmount(raw: string): number {
  // Drop spaces, currency symbols… and normalise the typographic minus.
  const text = raw.replace(/[\u2212\u2013]/g, "-").replace(/[^\d,.+-]/g, "");
  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? "," : ".";
    const thousands = decimal === "," ? /\./g : /,/g;
    normalized = text.replace(thousands, "").replace(decimal, ".");
  } else if (lastComma >= 0) {
    normalized = text.replace(",", ".");
  } else if (lastDot >= 0 && text.indexOf(".") !== lastDot) {
    normalized = text.replace(/\./g, "");
  } else {
    normalized = text;
  }

  return /^[+-]?\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN;
}
