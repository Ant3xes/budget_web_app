import { parseAmount } from "./parse-amount";

export type ParsedTransaction = {
  date: string; // YYYY-MM-DD
  description: string;
  amount_cents: number; // negative = expense, positive = income
  raw: Record<string, string>;
  /** N26 `Type` column (Presentment, Debit Transfer, ...). Absent when the column is. */
  source_type?: string;
  /** BNP `Sous Categorie operation`. Absent when the column is. */
  source_category?: string;
};

const TRANSFER_SOURCE_TYPES = new Set(["debit transfer", "credit transfer", "moneybeam"]);

/** N26 types that move money between people/accounts: suggestion only (issue 125). */
export function isTransferSourceType(sourceType: string | undefined): boolean {
  return !!sourceType && TRANSFER_SOURCE_TYPES.has(sourceType.trim().toLowerCase());
}

/**
 * Parses N26 CSV content.
 * Headers on row 0. Relevant columns: "Booking Date" (YYYY-MM-DD), "Payee", "Amount (EUR)".
 */
export function parseN26Csv(content: string): ParsedTransaction[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const dateIdx = headers.findIndex((h) => h.trim().toLowerCase() === "booking date");
  const descIdx = headers.findIndex(
    (h) => h.trim().toLowerCase() === "payee" || h.trim().toLowerCase() === "partner name",
  );
  const typeIdx = headers.findIndex((h) => h.trim().toLowerCase() === "type");
  const amountIdx = headers.findIndex((h) => h.trim().toLowerCase() === "amount (eur)");

  if (dateIdx === -1 || amountIdx === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length <= Math.max(dateIdx, amountIdx)) continue;

    const dateRaw = cols[dateIdx]?.trim() ?? "";
    const descRaw = descIdx >= 0 ? (cols[descIdx]?.trim() ?? "") : "";
    const amountRaw = cols[amountIdx]?.trim() ?? "";

    if (!dateRaw || !amountRaw) continue;

    const amountFloat = parseAmount(amountRaw);
    if (isNaN(amountFloat)) continue;

    const amount_cents = Math.round(amountFloat * 100);

    // Build raw record for storage
    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = cols[idx] ?? "";
    });

    const sourceType = typeIdx >= 0 ? (cols[typeIdx]?.trim() ?? "") : "";

    transactions.push({
      date: dateRaw, // already YYYY-MM-DD
      description: descRaw || "N26 transaction",
      amount_cents,
      raw,
      ...(sourceType ? { source_type: sourceType } : {}),
    });
  }

  return transactions;
}

/** Minimal RFC 4180-compatible CSV line parser */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}
