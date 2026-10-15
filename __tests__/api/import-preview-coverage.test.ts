import * as XLSX from "xlsx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createChainableMock } from "@/__tests__/mocks/supabase";
import { POST } from "@/app/api/import/preview/route";
import { buildDefaultMatcher, buildHistoryMatcher, buildRuleMatcher, buildRuleShareMatcher, detectTransfer } from "@/lib/import/apply-rules";
import { findExistingHashes, findTransferMirrorMatches } from "@/lib/import/deduplicate";
import { withSpace } from "@/lib/spaces/with-space";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
vi.mock("xlsx", async importOriginal => {
  const actual = await importOriginal<typeof import("xlsx")>();
  return { ...actual, read: vi.fn(actual.read) };
});
vi.mock("@/lib/import/apply-rules", () => ({
  buildRuleMatcher: vi.fn(), buildHistoryMatcher: vi.fn(), buildDefaultMatcher: vi.fn(), buildRuleShareMatcher: vi.fn(), detectTransfer: vi.fn(),
}));
vi.mock("@/lib/import/deduplicate", () => ({
  buildFileHashes: vi.fn((rows: { description: string }[]) => rows.map(row => `hash-${row.description}`)),
  findExistingHashes: vi.fn(), findTransferMirrorMatches: vi.fn(),
}));

const accountId = "00000000-0000-4000-8000-0000000000a1";
const sharedId = "shared-space";
const n26 = ["Booking Date,Partner Name,Type,Amount (EUR)", "2026-01-01,Netflix,Presentment,-9.99", "2026-01-02,Boutique Synthetique,Presentment,-5.00"].join("\n");
const bnpRows = [["Compte synthetique"], ["Date operation", "Libelle operation", "Montant operation", "Sous Categorie operation"], ["01-01-2026", "PAIEMENT CB BOUTIQUE SYNTHETIQUE DU 01/01/26 CARTE*1234", "-5,00", "Divers"]];
const categories = [
  { id: "cat-rule", name: "Rule", kind: "expense", translation_key: null },
  { id: "cat-sub", name: "Abonnements", kind: "expense", translation_key: "abonnements" },
];
const file = (content: BlobPart, name: string) => new File([content], name);
const xlsx = (rows: unknown[][]) => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Synthetic");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
};
const request = (upload?: File, account?: string) => {
  const body = new FormData();
  if (upload) body.append("file", upload);
  if (account) body.append("account_id", account);
  return new Request("http://test/api/import/preview", { method: "POST", body });
};
function setup({ kind = "personal", categoryData = categories, spaceData = [{ id: sharedId, name: "Foyer", default_share_percent: "40" }] }: { kind?: string; categoryData?: unknown; spaceData?: unknown } = {}) {
  const categoriesChain = createChainableMock({ data: categoryData, error: null });
  const spacesChain = createChainableMock({ data: spaceData, error: null });
  const from = vi.fn((table: string) => (table === "categories" ? categoriesChain : spacesChain));
  vi.mocked(withSpace).mockResolvedValue({ spaceId: "space", space: { kind }, spaces: [{ id: sharedId, kind: "shared" }], supabase: { from } } as never);
  return { from };
}
const run = async (upload?: File, account?: string) => POST(request(upload, account));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(buildRuleMatcher).mockResolvedValue(() => null);
  vi.mocked(buildHistoryMatcher).mockResolvedValue(() => null);
  vi.mocked(buildDefaultMatcher).mockReturnValue(() => null);
  vi.mocked(buildRuleShareMatcher).mockResolvedValue(() => null);
  vi.mocked(detectTransfer).mockReturnValue(false);
  vi.mocked(findExistingHashes).mockResolvedValue(new Set());
  vi.mocked(findTransferMirrorMatches).mockResolvedValue(new Set());
  setup();
});

describe("import preview coverage", () => {
  it("returns 401 before reading the form", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);
    expect((await run(file(n26, "a.csv"))).status).toBe(401);
  });
  it("rejects an empty CSV with a clear message", async () => {
    const response = await run(file("", "empty.csv"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Format CSV non reconnu. Formats supportés : N26." });
  });
  it.each([["export.XLS"], ["export.XLSX"]])("recognizes %s regardless of case and cleans BNP labels", async name => {
    const response = await run(file(xlsx(bnpRows), name));
    const [row] = (await response.json()).preview;
    expect(row).toMatchObject({ date: "2026-01-01", amount_cents: -500, source_category: "Divers", clean_description: "Boutique Synthetique", raw_description: "PAIEMENT CB BOUTIQUE SYNTHETIQUE DU 01/01/26 CARTE*1234" });
  });
  it("rejects an XLS without a worksheet", async () => {
    vi.mocked(XLSX.read).mockReturnValueOnce({ SheetNames: [], Sheets: {} });
    const response = await run(file("ignored", "empty.xls"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Fichier XLS vide ou invalide" });
  });
  it("rejects an empty sheet and an unrecognized XLS header as unsupported", async () => {
    for (const rows of [[], [["Date", "Montant"], ["01-01-2026", "-1"]]]) {
      const response = await run(file(xlsx(rows), "unknown.xlsx"));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "Format XLS non reconnu. Formats supportés : BNP." });
    }
  });
  it("reports unreadable XLS content without leaking the parser failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(XLSX.read).mockImplementationOnce(() => { throw new Error("internal parser detail"); });
    const response = await run(file("broken", "broken.xls"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Impossible de lire le fichier XLS" });
    expect(log).toHaveBeenCalledWith("[import/preview] XLS parse error:", expect.any(Error));
    log.mockRestore();
  });
  it("rejects a recognized BNP header without usable transactions", async () => {
    const response = await run(file(xlsx([["Date operation", "Libelle operation", "Montant operation"]]), "empty-bnp.xls"));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Aucune transaction trouvée dans le fichier" });
  });
  it("labels already imported rows and mirrors separately and gives them no suggestion", async () => {
    setup();
    vi.mocked(findExistingHashes).mockResolvedValue(new Set(["hash-Netflix"]));
    vi.mocked(findTransferMirrorMatches).mockResolvedValue(new Set([0]));
    vi.mocked(buildRuleMatcher).mockResolvedValue(() => "cat-rule");
    const response = await run(file(n26, "n26.csv"), accountId);
    expect((await response.json()).preview.map((row: Record<string, unknown>) => [row.description, row.is_duplicate, row.duplicate_reason, row.suggested_category_id])).toEqual([["Netflix", true, "already_imported", null], ["Boutique Synthetique", true, "transfer_mirror", null]]);
    expect(findTransferMirrorMatches).toHaveBeenCalledWith(expect.anything(), "space", accountId, [{ date: "2026-01-02", amount_cents: -500 }]);
  });
  it.each([
    ["rule", () => { vi.mocked(buildRuleMatcher).mockResolvedValue(() => "cat-rule"); vi.mocked(buildHistoryMatcher).mockResolvedValue(() => "cat-history"); vi.mocked(buildDefaultMatcher).mockReturnValue(() => "cat-default"); }, "cat-rule"],
    ["history", () => { vi.mocked(buildHistoryMatcher).mockResolvedValue(() => "cat-history"); vi.mocked(buildDefaultMatcher).mockReturnValue(() => "cat-default"); }, "cat-history"],
    ["merchant", () => { vi.mocked(buildDefaultMatcher).mockReturnValue(() => "cat-default"); }, "cat-sub"],
    ["default", () => { setup({ categoryData: [] }); vi.mocked(buildDefaultMatcher).mockReturnValue(() => "cat-default"); }, "cat-default"],
  ])("uses %s as the first matching suggestion source", async (source, arrange, categoryId) => {
    arrange();
    const response = await run(file(n26, "n26.csv"));
    expect((await response.json()).preview[0]).toMatchObject({ suggested_category_id: categoryId, suggestion_source: source });
  });
  it("tolerates missing category and share-target data", async () => {
    setup({ categoryData: null, spaceData: null });
    vi.mocked(buildRuleShareMatcher).mockResolvedValue(() => ({ space_id: sharedId, category_id: null, payer_share_percent: null }));
    const response = await run(file(n26, "n26.csv"));
    const { preview } = await response.json();
    expect(buildDefaultMatcher).toHaveBeenCalledWith([]);
    expect(preview.map((row: Record<string, unknown>) => row.suggested_share)).toEqual([null, null]);
  });
  it("keeps rule share percentages and falls back to a numeric space default", async () => {
    vi.mocked(buildRuleShareMatcher).mockResolvedValue(description => description === "Netflix" ? { space_id: sharedId, category_id: "cat-share", payer_share_percent: 0 } : { space_id: sharedId, category_id: null, payer_share_percent: null });
    const { preview } = await (await run(file(n26, "n26.csv"))).json();
    expect(preview.map((row: Record<string, unknown>) => row.suggested_share)).toEqual([
      { space_id: sharedId, space_name: "Foyer", category_id: "cat-share", payer_share_percent: 0 },
      { space_id: sharedId, space_name: "Foyer", category_id: null, payer_share_percent: 40 },
    ]);
  });
});
