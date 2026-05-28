import * as XLSX from "xlsx";

import type { ParsedTransaction } from "./parse-n26";

/**
 * Parses BNP XLS/XLSX content (as ArrayBuffer).
 * Row 0: account info (ignore).
 * Row 1: real column headers — includes "Date operation", "Libelle operation", "Montant".
 * Rows 2+: data.
 * Date format: DD-MM-YYYY or DD/MM/YYYY.
 */
export function parseBnpXls(buffer: ArrayBuffer): ParsedTransaction[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
  if (!sheet) return [];

  // Read all rows as raw strings (no header parsing)
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false }) as string[][];

  // Find header row dynamically — BNP exports may have an empty row between
  // the account-info row and the actual column headers.
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i] ?? [];
    if (row.some((cell) => String(cell).trim().toLowerCase().includes("date operation"))) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return [];

  const headers: string[] = (rows[headerRowIdx] ?? []).map((h) => String(h ?? "").trim());

  const dateIdx = headers.findIndex((h) => h.toLowerCase().includes("date operation") || h.toLowerCase() === "date");
  const descIdx = headers.findIndex(
    (h) =>
      h.toLowerCase().includes("libelle") ||
      h.toLowerCase().includes("intitulé") ||
      h.toLowerCase().includes("libellé"),
  );
  const amountIdx = headers.findIndex(
    (h) => h.toLowerCase() === "montant" || h.toLowerCase().includes("montant"),
  );

  if (dateIdx === -1 || amountIdx === -1) return [];

  const transactions: ParsedTransaction[] = [];

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const cols = rows[i] ?? [];
    const dateRaw = String(cols[dateIdx] ?? "").trim();
    const descRaw = descIdx >= 0 ? String(cols[descIdx] ?? "").trim() : "";
    const amountRaw = String(cols[amountIdx] ?? "").trim().replace(",", ".").replace(/\s/g, "");

    if (!dateRaw || !amountRaw) continue;

    const amountFloat = parseFloat(amountRaw);
    if (isNaN(amountFloat)) continue;

    const amount_cents = Math.round(amountFloat * 100);

    // Normalize date from DD-MM-YYYY or DD/MM/YYYY to YYYY-MM-DD
    const dateParsed = parseBnpDate(dateRaw);
    if (!dateParsed) continue;

    const raw: Record<string, string> = {};
    headers.forEach((h, idx) => {
      raw[h] = String(cols[idx] ?? "");
    });

    transactions.push({
      date: dateParsed,
      description: descRaw || "BNP transaction",
      amount_cents,
      raw,
    });
  }

  return transactions;
}

function parseBnpDate(raw: string): string | null {
  // Supports DD-MM-YYYY and DD/MM/YYYY
  const match = raw.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}
