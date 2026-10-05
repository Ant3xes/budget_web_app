import { parseAmount } from "@/lib/import/parse-amount";

/**
 * Converts an amount typed in euros ("12,5", "12.5", "1 234,56", "-50") into
 * integer cents. Empty input means 0. Returns null when the text is not a
 * valid amount, so callers never send NaN (issue 103).
 */
export function parseEurosToCents(raw: string): number | null {
  if (raw.trim() === "") return 0;
  // parseAmount silently drops letters ("1e999" → 1999): refuse them here.
  if (/[^\d\s\u00a0\u202f,.+\-\u2212\u2013€]/.test(raw)) return null;
  const euros = parseAmount(raw);
  if (!Number.isFinite(euros)) return null;
  const cents = Math.round(euros * 100);
  if (!Number.isSafeInteger(cents)) return null;
  // Math.round(-0.4) is -0: normalise so it serialises as 0.
  return cents === 0 ? 0 : cents;
}

/**
 * Formats integer cents as an editable euro string with a French decimal
 * comma ("1999" → "19,99"). Pure integer arithmetic: no float rounding error.
 */
export function formatCentsToEuros(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(cents));
  const euros = Math.floor(abs / 100);
  const rest = abs % 100;
  return rest === 0 ? `${sign}${euros}` : `${sign}${euros},${String(rest).padStart(2, "0")}`;
}
