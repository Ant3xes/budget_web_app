import { must } from "@/__tests__/helpers/must";
// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImportModal } from "@/components/import/import-modal";
import { LocaleProvider } from "@/components/locale-provider";

const accounts = [{ id: "account-a", name: "Synthetic current" }, { id: "account-b", name: "Synthetic savings" }];
const categories = [
  { id: "food", name: "Synthetic food", kind: "expense", icon: "🍎" },
  { id: "other", name: "Synthetic other", kind: "expense", icon: null },
  { id: "salary", name: "Synthetic salary", kind: "income", icon: null },
];
const share = { space_id: "space-synthetic", space_name: "Synthetic home", category_id: "shared-food", payer_share_percent: 60 };
const row = (hash: string, overrides = {}) => ({
  hash, date: "2026-10-01", description: `RAW ${hash}`, clean_description: `Clean ${hash}`,
  amount_cents: -1234, kind: "expense", suggested_category_id: "food", suggestion_source: "rule",
  is_transfer_candidate: false, is_duplicate: false, ...overrides,
});
type Row = ReturnType<typeof row>;
type Options = {
  preview?: Row[]; defaultAccountId?: string; spaceKind?: "personal" | "shared";
  previewResponse?: () => Promise<Response>; confirmResponse?: () => Promise<Response>;
  accountsResponse?: Response; categoriesResponse?: Response;
};
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}
function setup(options: Options = {}) {
  let list = [...categories];
  const fetchMock = vi.fn((url: string, init?: RequestInit): Promise<Response> => {
    if (url === "/api/accounts") return Promise.resolve(options.accountsResponse ?? Response.json({ accounts }));
    if (url === "/api/categories" && init?.method === "POST") {
      const input = JSON.parse(init.body as string);
      list = [...list, { id: "created", ...input, icon: null }];
      return Promise.resolve(Response.json({ ok: true }));
    }
    if (url === "/api/categories") return Promise.resolve(options.categoriesResponse ?? Response.json({ categories: list }));
    if (url === "/api/import/preview") return options.previewResponse?.() ?? Promise.resolve(Response.json({ preview: options.preview ?? [row("one")] }));
    if (url === "/api/import/confirm") return options.confirmResponse?.() ?? Promise.resolve(Response.json({ imported: 1 }));
    throw new Error(`Unexpected URL: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  render(<LocaleProvider><ImportModal defaultAccountId={options.defaultAccountId} spaceKind={options.spaceKind} onClose={onClose} onSuccess={onSuccess} /></LocaleProvider>);
  return {
    fetchMock, onClose, onSuccess,
    body: () => {
      const call = fetchMock.mock.calls.find(([url]) => url === "/api/import/confirm");
      return call ? JSON.parse(call[1]?.body as string) : null;
    },
    async upload() {
      if (!options.defaultAccountId) {
        await screen.findByRole("option", { name: "Synthetic current" });
        fireEvent.change(screen.getByLabelText("Compte de destination"), { target: { value: "account-a" } });
      } else await screen.findByText("Synthetic current");
      fireEvent.change(screen.getByLabelText("Fichier"), { target: { files: [new File(["synthetic,csv"], "synthetic.csv", { type: "text/csv" })] } });
      fireEvent.click(screen.getByRole("button", { name: "Analyser le fichier" }));
      await screen.findByText("Étape 2 — Dépenses");
    },
  };
}
const tableRow = (label: string) => screen.getByTitle(`RAW ${label}`).closest("tr")!;
const change = (element: HTMLElement, value: string) => fireEvent.change(element, { target: { value } });
const next = () => fireEvent.click(screen.getByRole("button", { name: "Suivant →" }));
const back = () => fireEvent.click(screen.getByRole("button", { name: "← Retour" }));
const confirm = () => fireEvent.click(screen.getByRole("button", { name: /^Importer \d+ transaction/ }));
const selectValue = (element: HTMLElement) => (element as HTMLSelectElement).value;

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("ImportModal interface coverage", () => {
  it("never preselects the first account and requires a file then an explicit account", async () => {
    const { fetchMock, onClose } = setup();
    await screen.findByRole("option", { name: "Synthetic current" });
    expect(selectValue(screen.getByLabelText("Compte de destination"))).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Analyser le fichier" }));
    expect(screen.getByText("Veuillez sélectionner un fichier")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Fichier"), { target: { files: [new File(["x"], "synthetic.csv")] } });
    fireEvent.click(screen.getByRole("button", { name: "Analyser le fichier" }));
    expect(screen.getByText("Veuillez sélectionner un compte")).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/import/preview")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onClose).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("uploads to the supplied account, shows the clean label, raw tooltip and all suggestion badges", async () => {
    const { upload, fetchMock } = setup({ defaultAccountId: "account-a", preview: [
      row("one"), row("two", { suggestion_source: "history" }), row("three", { suggestion_source: "merchant" }),
      row("four", { suggestion_source: "default" }), row("five", { clean_description: null, suggestion_source: null }),
    ] });
    expect(screen.queryByLabelText("Compte de destination")).toBeNull();
    await upload();
    expect(screen.getByTitle("RAW one").textContent).toContain("Clean one");
    for (const text of ["règle", "historique", "marchand", "mots-clés", "RAW five"]) expect(screen.getByText(text)).toBeTruthy();
    const request = fetchMock.mock.calls.find(([url]) => url === "/api/import/preview")![1]!;
    expect(request.method).toBe("POST");
    const data = request.body as FormData;
    expect(data.get("account_id")).toBe("account-a");
    expect((data.get("file") as File).name).toBe("synthetic.csv");
    back();
    expect(screen.getByRole("button", { name: "Analyser le fichier" })).toBeTruthy();
  });

  it.each([
    [400, { error: "Synthetic parse failure" }, "Synthetic parse failure"],
    [400, {}, "Erreur lors du parsing"],
    [200, { preview: [] }, "Aucune transaction trouvée dans ce fichier."],
  ])("reports preview response %s without progressing", async (status, data, message) => {
    const pending = deferred();
    const { fetchMock } = setup({ previewResponse: () => pending.promise });
    await screen.findByRole("option", { name: "Synthetic current" });
    change(screen.getByLabelText("Compte de destination"), "account-a");
    fireEvent.change(screen.getByLabelText("Fichier"), { target: { files: [new File(["x"], "synthetic.csv")] } });
    fireEvent.click(screen.getByRole("button", { name: "Analyser le fichier" }));
    expect((screen.getByRole("button", { name: "Analyse en cours…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending.resolve(Response.json(data, { status })));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(fetchMock.mock.calls.some(([url]) => url === "/api/import/confirm")).toBe(false);
  });

  it("filtering changes no categories and applying targets only checked visible rows", async () => {
    const { upload, body } = setup({ preview: [row("one"), row("two"), row("hidden", { suggested_category_id: "other" }), row("empty", { suggested_category_id: null })] });
    await upload();
    fireEvent.click(within(tableRow("two")).getByRole("checkbox"));
    change(must(screen.getAllByRole("combobox")[0]), "food");
    expect(screen.queryByTitle("RAW hidden")).toBeNull();
    expect(selectValue(within(tableRow("one")).getByRole("combobox"))).toBe("food");
    change(must(screen.getAllByRole("combobox")[1]), "other");
    fireEvent.click(screen.getByRole("button", { name: "Appliquer à la sélection" }));
    change(must(screen.getAllByRole("combobox")[0]), "");
    expect(selectValue(within(tableRow("one")).getByRole("combobox"))).toBe("other");
    expect(selectValue(within(tableRow("two")).getByRole("combobox"))).toBe("food");
    expect(selectValue(within(tableRow("hidden")).getByRole("combobox"))).toBe("other");
    expect(selectValue(within(tableRow("empty")).getByRole("combobox"))).toBe("");
    change(within(tableRow("empty")).getByRole("combobox"), "food");
    change(must(screen.getAllByRole("combobox")[0]), "__none__");
    // The filter is list-only, including the no-category sentinel.
    next(); back();
    next(); next(); confirm();
    await screen.findByText("Import terminé");
    expect(body().transactions.map((r: { hash: string; category_id: string }) => [r.hash, r.category_id])).toEqual([["one", "other"], ["hidden", "other"], ["empty", "food"]]);
  });

  it.each(["row", "bulk", "income"])("creates a category from %s without losing preview selection (issue 119)", async (target) => {
    const { upload, fetchMock, body } = setup({ preview: [row("one"), row("pay", { kind: "income", amount_cents: 2500, suggested_category_id: "salary" })] });
    await upload();
    if (target === "income") next();
    const visible = target === "income" ? "pay" : "one";
    change(target === "bulk" ? must(screen.getAllByRole("combobox")[1]) : within(tableRow(visible)).getByRole("combobox"), "__new__");
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(screen.queryByRole("textbox")).toBeNull();
    change(target === "bulk" ? must(screen.getAllByRole("combobox")[1]) : within(tableRow(visible)).getByRole("combobox"), "__new__");
    change(screen.getByRole("textbox"), "  Synthetic created  ");
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
    if (target === "bulk") fireEvent.click(screen.getByRole("button", { name: "Appliquer à la sélection" }));
    expect(selectValue(within(tableRow(visible)).getByRole("combobox"))).toBe("created");
    expect((within(tableRow(visible)).getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/categories", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "Synthetic created", kind: target === "income" ? "income" : "expense" }) }));
    if (target !== "income") next();
    next(); confirm();
    await screen.findByText("Import terminé");
    expect(body().transactions.find((r: { hash: string }) => r.hash === visible).category_id).toBe("created");
  });

  it("excludes duplicates until checked, supports select none/all and blocks an empty import", async () => {
    const { upload, body } = setup({ preview: [row("one"), row("dup", { is_duplicate: true }), row("dup2", { is_duplicate: true })] });
    await upload();
    expect(screen.getByText(/2 doublons détectés/)).toBeTruthy();
    expect((within(tableRow("dup")).getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    expect(within(tableRow("dup")).queryByRole("combobox")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tout désélectionner" }));
    next(); next();
    expect((screen.getByRole("button", { name: "Importer 0 transaction" }) as HTMLButtonElement).disabled).toBe(true);
    back(); back();
    fireEvent.click(screen.getByRole("button", { name: "Tout sélectionner" }));
    expect((within(tableRow("dup")).getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(within(tableRow("dup")).getByRole("checkbox"));
    expect(within(tableRow("dup")).getByRole("combobox")).toBeTruthy();
    next(); next(); confirm();
    await screen.findByText("Import terminé");
    expect(body().transactions.map((r: { hash: string }) => r.hash)).toEqual(["one", "dup"]);
  });

  it("requires explicit choices for every transfer and sends internal/external payloads", async () => {
    const { upload, body } = setup({ preview: [
      row("out", { is_transfer_candidate: true, source_type: "bank", source_category: "synthetic" }),
      row("in", { is_transfer_candidate: true, kind: "income", amount_cents: 900, suggested_category_id: "salary" }),
    ] });
    await upload();
    expect(screen.getByText("Aucune transaction de type « dépense » dans ce fichier.")).toBeTruthy();
    next(); next();
    expect(screen.getByText("2 virement(s) à choisir : interne ou externe.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Importer 2 transactions" }) as HTMLButtonElement).disabled).toBe(true);
    const out = within(tableRow("out"));
    const incoming = within(tableRow("in"));
    expect(out.queryByRole("option", { name: /Interne → Synthetic current/ })).toBeNull();
    change(out.getByRole("combobox"), "internal:account-b");
    expect(screen.getByText("1 virement(s) à choisir : interne ou externe.")).toBeTruthy();
    change(out.getByRole("combobox"), "");
    expect(screen.getByText("2 virement(s) à choisir : interne ou externe.")).toBeTruthy();
    change(out.getByRole("combobox"), "internal:account-b");
    change(incoming.getByRole("combobox"), "external");
    change(must(incoming.getAllByRole("combobox")[1]), "salary");
    confirm();
    await screen.findByText("Import terminé");
    expect(body()).toEqual({ account_id: "account-a", transactions: [
      { hash: "out", source_type: "bank", source_category: "synthetic", date: "2026-10-01", description: "Clean out", raw_label: "RAW out", amount_cents: -1234, kind: "transfer", transfer_account_id: "account-b", category_id: null },
      { hash: "in", source_type: null, source_category: null, date: "2026-10-01", description: "Clean in", raw_label: "RAW in", amount_cents: 900, kind: "income", category_id: "salary" },
    ] });
  });

  it("offers bulk external/internal choices, lets transfers return to their original step and unchecks them", async () => {
    const { upload, body } = setup({ preview: [row("one"), row("pay", { kind: "income", amount_cents: 200, is_transfer_candidate: true })] });
    await upload();
    fireEvent.click(within(tableRow("one")).getByRole("button", { name: "Marquer comme virement" }));
    expect(screen.queryByTitle("RAW one")).toBeNull();
    next(); next();
    fireEvent.click(screen.getByRole("button", { name: "Tout marquer externe" }));
    expect(selectValue(must(within(tableRow("one")).getAllByRole("combobox")[0]))).toBe("external");
    change(must(within(tableRow("one")).getAllByRole("combobox")[1]), "other");
    change(must(screen.getAllByRole("combobox")[0]), "account-b");
    fireEvent.click(screen.getByRole("button", { name: "Tout marquer interne vers Synthetic savings" }));
    expect(selectValue(within(tableRow("pay")).getByRole("combobox"))).toBe("internal:account-b");
    fireEvent.click(within(tableRow("one")).getByRole("button", { name: "Retirer du virement" }));
    fireEvent.click(within(tableRow("pay")).getByRole("checkbox"));
    back(); back();
    expect(screen.getByTitle("RAW one")).toBeTruthy();
    next(); next(); confirm();
    await screen.findByText("Import terminé");
    expect(body().transactions).toHaveLength(1);
    expect(body().transactions[0]).toMatchObject({ kind: "expense", category_id: "other" });
  });

  it.each(["personal", "shared"] as const)("respects %s space sharing and the share checkbox", async (spaceKind) => {
    const { upload, body } = setup({ spaceKind, preview: [row("one", { suggested_share: share }), row("dup", { is_duplicate: true, suggested_share: share })], confirmResponse: async () => Response.json({ imported: 1, shared: 1 }) });
    await upload();
    if (spaceKind === "personal") {
      expect(screen.getByRole("columnheader", { name: "Partagé" })).toBeTruthy();
      const toggle = screen.getByLabelText("→ Synthetic home · 60 %");
      fireEvent.click(toggle);
      expect((toggle as HTMLInputElement).checked).toBe(false);
      fireEvent.click(toggle);
    } else expect(screen.queryByRole("columnheader", { name: "Partagé" })).toBeNull();
    next(); next(); confirm();
    await screen.findByText("1 transaction importée, 1 partagée(s).");
    if (spaceKind === "personal") expect(body().transactions[0].share).toEqual({ space_id: share.space_id, category_id: share.category_id, payer_share_percent: 60 });
    else expect(body().transactions[0]).not.toHaveProperty("share");
  });

  it("omits opted-out sharing and sharing on transfers or duplicates", async () => {
    const { upload, body } = setup({ preview: [row("one", { suggested_share: share }), row("transfer", { suggested_share: share, is_transfer_candidate: true }), row("dup", { suggested_share: share, is_duplicate: true })] });
    await upload();
    fireEvent.click(screen.getByLabelText("→ Synthetic home · 60 %"));
    fireEvent.click(within(tableRow("dup")).getByRole("checkbox"));
    next(); next();
    fireEvent.click(screen.getByRole("button", { name: "Tout marquer externe" }));
    confirm();
    await screen.findByText("Import terminé");
    expect(body().transactions.every((r: object) => !("share" in r))).toBe(true);
  });

  it.each(["api", "fallback", "invalid-json"])("allows retry after %s confirmation error, disables while saving then closes through success", async (mode) => {
    const pending = deferred();
    let attempt = 0;
    const { upload, onSuccess, onClose } = setup({ confirmResponse: async () => {
      if (attempt++ > 0) return Response.json({ imported: 2 });
      return pending.promise;
    } });
    await upload(); next(); next(); confirm();
    expect((screen.getByRole("button", { name: "Import en cours…" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => pending.resolve(mode === "invalid-json" ? new Response("bad", { status: 500 }) : Response.json(mode === "api" ? { error: "Synthetic confirmation failure" } : {}, { status: 500 })));
    expect(await screen.findByText(mode === "api" ? "Synthetic confirmation failure" : "Erreur lors de l'import")).toBeTruthy();
    confirm();
    await screen.findByText("2 transactions importées avec succès.");
    fireEvent.click(screen.getAllByRole("button", { name: "Fermer" }).find((button) => button.textContent === "Fermer")!);
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
  });

  it.each([false, true])("keeps upload usable when option endpoints are unavailable (empty payload: %s)", async (empty) => {
    setup({ accountsResponse: Response.json(empty ? { accounts: [] } : {}, { status: empty ? 200 : 500 }), categoriesResponse: Response.json({}, { status: empty ? 200 : 500 }) });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect(selectValue(screen.getByLabelText("Compte de destination"))).toBe("");
    expect(screen.getByRole("button", { name: "Analyser le fichier" })).toBeTruthy();
  });
});
