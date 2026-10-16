import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";
import { parseBnpXls } from "@/lib/import/parse-bnp";
vi.mock("xlsx", async importOriginal => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return { ...actual, read: vi.fn(actual.read) };
});
function buffer(rows: unknown[][]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Synthetic");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}
describe("BNP malformed export coverage", () => {
  it("returns no transactions when the reader returns no worksheet", () => {
    vi.mocked(XLSX.read).mockReturnValueOnce({ SheetNames: [], Sheets: {} });
    expect(parseBnpXls(new ArrayBuffer(0))).toEqual([]);
  });
  it("requires the amount column even when the date header is recognizable", () => {
    expect(parseBnpXls(buffer([["Date operation", "Libelle"], ["01-01-2026", "Synthetic"]]))).toEqual([]);
  });
  it.each(["Intitulé", "Libellé", "Libelle"])("reads the %s alias and skips invalid rows", label => {
    const rows = [
      ["Date operation", "Montant", label, "Sous catégorie operation", "Optional"],
      ["01/01/2026", "-1.25", "Synthetic"],
      ["02-01-2026", "not-an-amount", "Invalid amount"],
      ["invalid-date", "-1", "Invalid date"],
      ["03-01-2026"],
      [],
      [null, "-1", "Missing date"],
      ["04-01-2026", "2", null, ""],
    ];
    const result = parseBnpXls(buffer(rows));
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ date: "2026-01-01", description: "Synthetic", amount_cents: -125, raw: { Optional: "", "Sous catégorie operation": "" } });
    expect(result[0]).not.toHaveProperty("source_category");
    expect(result[1]).toMatchObject({ date: "2026-01-04", description: "BNP transaction", amount_cents: 200 });
  });
  it("uses the fallback description when no label column exists", () => {
    expect(parseBnpXls(buffer([["Date operation", "Montant"], ["01-01-2026", "1"]]))[0]?.description).toBe("BNP transaction");
  });
  it("accepts the plain date alias before the detectable date-operation header", () => {
    expect(parseBnpXls(buffer([["Date", "Montant", "Date operation"], ["01-01-2026", "1", "ignored"]]))[0]?.date).toBe("2026-01-01");
  });
});
