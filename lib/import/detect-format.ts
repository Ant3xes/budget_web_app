export type ImportFormat = "n26" | "bnp" | "unknown";

/**
 * Detects import format from CSV/XLS headers.
 * N26 CSV has "Booking Date" and "Amount (EUR)" in row 0.
 * BNP XLS has account info in row 0; actual headers in row 1 include "Date operation".
 */
export function detectFormat(headers: string[]): ImportFormat {
  const normalized = headers.map((h) => h.trim().toLowerCase());

  if (normalized.some((h) => h.includes("booking date")) && normalized.some((h) => h.includes("amount (eur)"))) {
    return "n26";
  }

  if (normalized.some((h) => h.includes("date operation"))) {
    return "bnp";
  }

  return "unknown";
}
