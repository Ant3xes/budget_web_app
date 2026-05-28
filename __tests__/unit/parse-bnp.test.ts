import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parseBnpXls } from "@/lib/import/parse-bnp";

function makeBnpBuffer(rows: string[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return buf;
}

const SAMPLE_ROWS = [
  // Row 0: account info (ignored)
  ["Compte courant", "FR76XXXX", "", "", "Solde: 1234.56"],
  // Row 1: empty (as in real BNP exports)
  [],
  // Row 2: real column headers
  ["Date operation", "Categorie operation", "Sous Categorie operation", "Libelle operation", "Montant operation", "Pointage operation", "Commentaire operation"],
  // Row 3+: data
  ["15-01-2026", "Vie Quotidienne", "Streaming", "NETFLIX", "-15.99", "", ""],
  ["10-01-2026", "Revenus", "Salaire", "VIR SALAIRE EMPLOYEUR SA", "2500.00", "", ""],
  ["05-01-2026", "Vie Quotidienne", "Courses", "LIDL PARIS 001", "-42.30", "", ""],
];

describe("parseBnpXls", () => {
  it("parses valid BNP rows", () => {
    const buffer = makeBnpBuffer(SAMPLE_ROWS);
    const result = parseBnpXls(buffer);
    expect(result).toHaveLength(3);
  });

  it("converts DD-MM-YYYY dates to YYYY-MM-DD", () => {
    const buffer = makeBnpBuffer(SAMPLE_ROWS);
    const result = parseBnpXls(buffer);
    expect(result[0]?.date).toBe("2026-01-15");
    expect(result[1]?.date).toBe("2026-01-10");
  });

  it("converts amounts to cents", () => {
    const buffer = makeBnpBuffer(SAMPLE_ROWS);
    const result = parseBnpXls(buffer);
    expect(result[0]?.amount_cents).toBe(-1599);
    expect(result[1]?.amount_cents).toBe(250000);
    expect(result[2]?.amount_cents).toBe(-4230);
  });

  it("uses libelle as description", () => {
    const buffer = makeBnpBuffer(SAMPLE_ROWS);
    const result = parseBnpXls(buffer);
    expect(result[0]?.description).toBe("NETFLIX");
    expect(result[1]?.description).toBe("VIR SALAIRE EMPLOYEUR SA");
  });

  it("returns empty array when fewer than 3 rows", () => {
    const buffer = makeBnpBuffer([["account info"], ["Date operation", "Montant operation"]]);
    expect(parseBnpXls(buffer)).toHaveLength(0);
  });

  it("returns empty array when required headers are missing", () => {
    const buffer = makeBnpBuffer([
      ["account info"],
      ["Col1", "Col2", "Col3"],
      ["val1", "val2", "val3"],
    ]);
    expect(parseBnpXls(buffer)).toHaveLength(0);
  });

  it("skips rows with missing date or amount", () => {
    const rowsWithGap = [
      ...SAMPLE_ROWS.slice(0, 3),
      ["", "", "Empty row", "", "", "", ""],
      SAMPLE_ROWS[3]!,
    ];
    const buffer = makeBnpBuffer(rowsWithGap);
    const result = parseBnpXls(buffer);
    expect(result).toHaveLength(1);
  });

  it("also works when headers are at row 1 (no empty row)", () => {
    const rows = [
      ["Compte courant", "FR76XXXX"],
      ["Date operation", "Libelle operation", "Montant operation"],
      ["15-01-2026", "NETFLIX", "-15.99"],
    ];
    const buffer = makeBnpBuffer(rows);
    const result = parseBnpXls(buffer);
    expect(result).toHaveLength(1);
    expect(result[0]?.amount_cents).toBe(-1599);
  });
});
