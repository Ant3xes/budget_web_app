import { must } from "@/__tests__/helpers/must";
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { TransactionList } from "@/components/transactions/transaction-list";

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));

type Props = { onSuccess: () => void; onClose: () => void; [key: string]: unknown };
vi.mock("@/components/transactions/transaction-modal", () => ({
  TransactionModal: (p: Props) => (
    <section aria-label="Transaction modal" data-kind={String(p.kind)} data-id={String(p.transactionId ?? "")} data-raw={String(p.rawLabel ?? "")} data-values={JSON.stringify(p.defaultValues ?? null)}>
      <button onClick={p.onSuccess}>Transaction saved</button><button onClick={p.onClose}>Transaction closed</button>
    </section>
  ),
}));
vi.mock("@/components/transfers/transfer-modal", () => ({ TransferModal: (p: Props) => <section aria-label="Transfer modal"><button onClick={p.onSuccess}>Transfer saved</button><button onClick={p.onClose}>Transfer closed</button></section> }));
vi.mock("@/components/transactions/apply-rules-modal", () => ({ ApplyRulesModal: (p: Props) => <section aria-label="Rules modal"><button onClick={p.onSuccess}>Rules applied</button><button onClick={p.onClose}>Rules closed</button></section> }));
vi.mock("@/components/accounts/account-modal", () => ({ AccountModal: (p: Props) => <section aria-label="Account modal"><button onClick={p.onSuccess}>Account saved</button><button onClick={p.onClose}>Account closed</button></section> }));
vi.mock("@/components/import/import-modal", () => ({ ImportModal: (p: Props) => <section aria-label="Import modal" data-space={String(p.spaceKind)}><button onClick={p.onSuccess}>Import done</button><button onClick={p.onClose}>Import closed</button></section> }));
vi.mock("@/components/transactions/share-transaction-modal", () => ({
  ShareTransactionModal: (p: Props) => (
    <section aria-label="Share modal" data-id={String(p.transactionId)} data-existing={JSON.stringify(p.existing ?? null)}>
      <button onClick={p.onSuccess}>Share saved</button><button onClick={p.onClose}>Share closed</button>
    </section>
  ),
}));

const acc1 = "11111111-1111-4111-8111-111111111111";
const acc2 = "22222222-2222-4222-8222-222222222222";
const cat = "33333333-3333-4333-8333-333333333333";
const incomeCat = "44444444-4444-4444-8444-444444444444";
const base = { currency: "EUR", date: "2026-10-01T00:00:00Z", notes: null, is_imported: false, category_id: null, categories: null, to_account: null, shared_expenses: null, transfer_id: null, account_id: acc1, accounts: { name: "Account A" } };
const expense = { ...base, id: "e1", kind: "expense", amount_cents: -1234, description: "Synthetic expense" };
const income = { ...base, id: "i1", kind: "income", amount_cents: 5000, description: "Synthetic income" };
const transfer = { ...base, id: "t1", kind: "transfer_debit", amount_cents: -5000, description: "Synthetic transfer", transfer_id: "tr1", to_account: { id: acc2, name: "Account B" } };

type Config = { transactions: unknown[]; total?: number; accounts?: unknown[]; spaces?: unknown; deleteResponse?: () => Response; listOk?: boolean; refsOk?: boolean };
function setup(config: Config, spaceKind?: "personal" | "shared") {
  const cfg: Config = { accounts: [{ id: acc1, name: "Account A" }, { id: acc2, name: "Account B" }], spaces: [{ id: "space1", name: "Synthetic space" }], ...config };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "DELETE") return cfg.deleteResponse ? cfg.deleteResponse() : Response.json({});
    if (url.startsWith("/api/transactions")) return cfg.listOk === false ? Response.json({}, { status: 500 }) : Response.json({ transactions: cfg.transactions, total: cfg.total ?? cfg.transactions.length });
    if (cfg.refsOk === false && (url === "/api/accounts" || url === "/api/categories")) return Response.json({}, { status: 500 });
    if (url === "/api/accounts") return Response.json({ accounts: cfg.accounts });
    if (url === "/api/categories") return Response.json({ categories: [
      { id: cat, name: "Synthetic expense category", kind: "expense" },
      { id: incomeCat, name: "Synthetic income category", kind: "income" },
    ] });
    if (url === "/api/spaces") return cfg.spaces === false ? Response.json({}, { status: 500 }) : Response.json({ spaces: cfg.spaces });
    throw new Error(`Unexpected URL ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<LocaleProvider><TransactionList spaceKind={spaceKind} /></LocaleProvider>);
  const listCalls = () => fetchMock.mock.calls.map(([u]) => u).filter((u) => u.startsWith("/api/transactions?")).map((u) => new URLSearchParams(u.split("?")[1]));
  const lastList = () => listCalls().at(-1)!;
  return { fetchMock, listCalls, lastList };
}
const desktopRows = () => screen.getAllByRole("row").filter((r) => r.querySelector("td"));
const cards = () => screen.getAllByRole("list").find((l) => l.tagName === "UL" && l.className.includes("md:hidden"))!;
const chooseAdd = (name: string) => { fireEvent.click(screen.getByRole("button", { name: "+ Ajouter" })); return screen.findByRole("menuitem", { name }).then((item) => fireEvent.click(item)); };
const dialog = () => within(screen.getByRole("alertdialog"));

beforeEach(() => { nav.params = new URLSearchParams(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("TransactionList filters coverage", () => {
  it("starts from the drill-down parameters and requests them", async () => {
    nav.params = new URLSearchParams({ type: "income", category_id: incomeCat });
    const { lastList } = setup({ transactions: [income] });
    await screen.findAllByText("Synthetic income");
    expect(lastList().get("kind")).toBe("income");
    expect(lastList().get("category_id")).toBe(incomeCat);
    expect((screen.getAllByLabelText("Catégorie")[0] as HTMLSelectElement).value).toBe(incomeCat);
    expect(screen.getByText("2", { selector: "span" })).toBeTruthy(); // active filter badge: type + category
  });
  it.each(["bogus", ""])("falls back to all types for type=%j", async (value) => {
    nav.params = new URLSearchParams(value ? { type: value } : {});
    const { lastList } = setup({ transactions: [expense] });
    await screen.findAllByText("Synthetic expense");
    expect(lastList().has("kind")).toBe(false);
  });
  it("filters by type, offering only the matching categories, and drops a stale category", async () => {
    const { lastList } = setup({ transactions: [expense] });
    await screen.findAllByText("Synthetic expense");
    const select = () => screen.getAllByLabelText("Catégorie")[0] as HTMLSelectElement;
    expect(within(select()).getAllByRole("option").map((o) => o.textContent)).toEqual(["Toutes les catégories", "Sans catégorie", "Synthetic expense category", "Synthetic income category"]);
    fireEvent.change(select(), { target: { value: cat } });
    await waitFor(() => expect(lastList().get("category_id")).toBe(cat));
    fireEvent.click(must(screen.getAllByRole("button", { name: "Revenus" })[0]));
    await waitFor(() => expect(lastList().get("kind")).toBe("income"));
    expect(lastList().has("category_id")).toBe(false);
    expect(within(select()).queryByRole("option", { name: "Synthetic expense category" })).toBeNull();
    fireEvent.click(must(screen.getAllByRole("button", { name: "Virements" })[0]));
    await waitFor(() => expect(lastList().get("kind")).toBe("transfer"));
    expect(screen.queryAllByLabelText("Catégorie")).toHaveLength(0);
    fireEvent.click(must(screen.getAllByRole("button", { name: "Toutes" })[0]));
    await waitFor(() => expect(lastList().has("kind")).toBe(false));
  });
  it("filters by account, uncategorized, dates and trims nothing from the request", async () => {
    const { lastList } = setup({ transactions: [expense] });
    await screen.findAllByText("Synthetic expense");
    fireEvent.change(must(screen.getAllByLabelText("Compte")[0]), { target: { value: acc2 } });
    await waitFor(() => expect(lastList().get("account_id")).toBe(acc2));
    fireEvent.change(must(screen.getAllByLabelText("Catégorie")[0]), { target: { value: "__uncategorized__" } });
    await waitFor(() => expect(lastList().get("uncategorized")).toBe("true"));
    expect(lastList().has("category_id")).toBe(false);
    fireEvent.change(must(screen.getAllByLabelText("Du")[0]), { target: { value: "2026-10-01" } });
    fireEvent.change(must(screen.getAllByLabelText("Au")[0]), { target: { value: "2026-10-31" } });
    await waitFor(() => expect(lastList().get("date_to")).toBe("2026-10-31"));
    expect(lastList().get("date_from")).toBe("2026-10-01");
    expect(lastList().get("per_page")).toBe("25");
    expect(screen.getByText("4", { selector: "span" })).toBeTruthy();
  });
  it("searches on Enter and on the button, ignores other keys, and clears the search", async () => {
    const { lastList, listCalls } = setup({ transactions: [expense] });
    await screen.findAllByText("Synthetic expense");
    const input = screen.getAllByPlaceholderText("Rechercher…")[0];
    fireEvent.change(must(input), { target: { value: "synthetic query" } });
    fireEvent.keyDown(must(input), { key: "a" });
    expect(lastList().has("q")).toBe(false);
    fireEvent.keyDown(must(input), { key: "Enter" });
    await waitFor(() => expect(lastList().get("q")).toBe("synthetic query"));
    fireEvent.change(must(input), { target: { value: "second query" } });
    fireEvent.click(must(screen.getAllByRole("button", { name: "Rechercher" })[0]));
    await waitFor(() => expect(lastList().get("q")).toBe("second query"));
    const callsBeforeClear = listCalls().length;
    fireEvent.click(must(screen.getAllByRole("button", { name: "Effacer la recherche" })[0]));
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(callsBeforeClear));
    expect(lastList().has("q")).toBe(false);
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.queryAllByRole("button", { name: "Effacer la recherche" })).toHaveLength(0);
  });
  it("opens the mobile filter sheet with the same controls", async () => {
    setup({ transactions: [expense] });
    await screen.findAllByText("Synthetic expense");
    fireEvent.click(screen.getByRole("button", { name: "Filtres" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("button", { name: "Revenus" })).toBeTruthy();
    expect(within(sheet).getByLabelText("Compte")).toBeTruthy();
  });
});

describe("TransactionList pagination and states coverage", () => {
  it("requests the next and previous page and keeps the page when reloading", async () => {
    const { lastList } = setup({ transactions: [expense], total: 60 });
    await screen.findAllByText("Synthetic expense");
    screen.getByText(/60 résultats — page 1 \/ 3/);
    expect((screen.getByRole("button", { name: /Préc\./ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /Suiv\./ }));
    await waitFor(() => expect(lastList().get("page")).toBe("2"));
    await screen.findByText(/page 2 \/ 3/);
    fireEvent.click(screen.getByRole("button", { name: /Préc\./ }));
    await waitFor(() => expect(lastList().get("page")).toBe("1"));
  });
  it("shows the empty state, and an unchanged empty list when the request fails", async () => {
    setup({ transactions: [], listOk: false });
    await screen.findByText("Aucune transaction trouvée.");
    expect(screen.queryByRole("table")).toBeNull();
  });
  it("shows loading before the response arrives", async () => {
    let release!: () => void;
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.startsWith("/api/transactions")) await new Promise<void>((r) => { release = r; });
      return Response.json({ transactions: [], total: 0, accounts: [], categories: [], spaces: [] });
    }));
    render(<LocaleProvider><TransactionList /></LocaleProvider>);
    expect(screen.getByText("Chargement…")).toBeTruthy();
    release();
    await screen.findByText("Aucune transaction trouvée.");
  });
  it("keeps working when accounts and categories cannot be loaded or have no list", async () => {
    setup({ transactions: [expense], refsOk: false });
    await screen.findAllByText("Synthetic expense");
    expect(screen.queryByRole("option", { name: "Account A" })).toBeNull();
    expect((screen.getByRole("button", { name: "Importer" }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("TransactionList incomplete payloads", () => {
  it("falls back to empty lists when accounts, categories and spaces responses omit their arrays", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => (url.startsWith("/api/transactions") ? Response.json({ transactions: [expense], total: 1 }) : Response.json({}))));
    render(<LocaleProvider><TransactionList /></LocaleProvider>);
    await screen.findAllByText("Synthetic expense");
    expect(must(screen.getAllByLabelText("Compte")[0]).querySelectorAll("option")).toHaveLength(1);
    expect(must(screen.getAllByLabelText("Catégorie")[0]).querySelectorAll("option")).toHaveLength(2);
    expect(within(must(desktopRows()[0])).getByRole("button", { name: "Partager avec un espace commun" })).toBeTruthy();
  });
});

describe("TransactionList rows coverage", () => {
  it("renders cards and table rows for each kind with transfer routes, fallbacks and badges", async () => {
    const rows = [
      { ...expense, is_imported: true, categories: { name: "Synthetic expense category", color: "#123456", icon: "🛒" }, category_id: cat },
      { ...income, accounts: null, categories: null },
      transfer,
      { ...transfer, id: "t2", description: "Transfer without names", accounts: null, to_account: null },
    ];
    setup({ transactions: rows });
    await screen.findAllByText("Synthetic expense");
    expect(desktopRows()).toHaveLength(4);
    expect(within(cards()).getAllByRole("listitem")).toHaveLength(4);
    expect(screen.getAllByText("import")).toHaveLength(2);
    expect(screen.getAllByText("Account A → Account B")).toHaveLength(2);
    expect(screen.getAllByText("— → —")).toHaveLength(2);
    expect(within(must(desktopRows()[1])).getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(within(must(desktopRows()[0])).getByText(/−12,34/)).toBeTruthy();
    expect(within(must(desktopRows()[1])).getByText(/\+50,00/)).toBeTruthy();
    expect(within(must(desktopRows()[2])).getByText(/50,00/).textContent).not.toMatch(/[+−]/);
    expect(within(cards()).getAllByText("Account A").length).toBeGreaterThan(0);
  });
  it("shows the net amount of a reimbursed expense and a badge on a linked refund", async () => {
    setup({ transactions: [
      { ...expense, id: "e2", description: "Synthetic reimbursed", amount_cents: -9000, reimbursed_cents: 6000, net_cents: 3000 },
      { ...expense, id: "e3", description: "Synthetic fully reimbursed", amount_cents: -9000, reimbursed_cents: 9000, net_cents: null },
      { ...income, id: "i2", description: "Synthetic refund", reimburses_transaction_id: "e2" },
      expense,
    ] });
    await screen.findAllByText("Synthetic reimbursed");
    const [net, zero, refund, plain] = desktopRows();
    expect(must(net).textContent).toMatch(/−30,00.*30,00.*sur.*90,00/);
    expect(must(zero).textContent).toMatch(/−0,00.*0,00.*sur.*90,00/);
    expect(within(must(refund)).getByText("Remboursement")).toBeTruthy();
    expect(must(plain).textContent).not.toContain("sur");
    expect(within(cards()).getAllByText(/30,00.*sur.*90,00/)).toHaveLength(1);
  });
  it("opens each edit modal with transfer and expense defaults, the raw bank label, and reloads on success", async () => {
    const raw = { ...expense, id: "e9", description: "Clean label", notes: "Synthetic note", category_id: cat, raw_import_data: { raw_label: "RAW LABEL" } };
    const { listCalls } = setup({ transactions: [raw, transfer] });
    await screen.findAllByText("Clean label");
    fireEvent.click(must(desktopRows()[0]));
    let modal = screen.getByRole("region", { name: "Transaction modal" });
    expect(modal.dataset.raw).toBe("RAW LABEL");
    expect(modal.dataset.id).toBe("e9");
    expect(JSON.parse(modal.dataset.values!)).toEqual({ account_id: acc1, amount: "12.34", date: "2026-10-01", description: "Clean label", category_id: cat, notes: "Synthetic note" });
    fireEvent.click(screen.getByRole("button", { name: "Transaction closed" }));
    expect(screen.queryByRole("region", { name: "Transaction modal" })).toBeNull();
    fireEvent.click(must(within(cards()).getAllByRole("button", { name: "Synthetic transfer" })[0]));
    modal = screen.getByRole("region", { name: "Transaction modal" });
    expect(modal.dataset.kind).toBe("transfer");
    expect(JSON.parse(modal.dataset.values!)).toEqual({ from_account_id: acc1, to_account_id: acc2, amount: "50", date: "2026-10-01", description: "Synthetic transfer", notes: "" });
    const before = listCalls().length;
    fireEvent.click(screen.getByRole("button", { name: "Transaction saved" }));
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    expect(screen.queryByRole("region", { name: "Transaction modal" })).toBeNull();
  });
  it("edits a transfer missing its destination and an income without raw label", async () => {
    setup({ transactions: [{ ...transfer, to_account: null }, income] });
    await screen.findAllByText("Synthetic income");
    fireEvent.click(must(desktopRows()[0]));
    expect(JSON.parse(screen.getByRole("region", { name: "Transaction modal" }).dataset.values!)).toMatchObject({ to_account_id: "" });
    fireEvent.click(screen.getByRole("button", { name: "Transaction closed" }));
    fireEvent.click(must(desktopRows()[1]));
    const modal = screen.getByRole("region", { name: "Transaction modal" });
    expect(modal.dataset.kind).toBe("income");
    expect(JSON.parse(modal.dataset.values!)).toMatchObject({ category_id: "" });
    expect(modal.dataset.raw).toBe("");
  });
});

describe("TransactionList actions coverage", () => {
  it("creates each transaction kind and reloads the first page after success", async () => {
    const { listCalls } = setup({ transactions: [expense], total: 60 });
    await screen.findAllByText("Synthetic expense");
    fireEvent.click(screen.getByRole("button", { name: /Suiv\./ }));
    await screen.findByText(/page 2/);
    for (const [name, kind] of [["+ Dépense", "expense"], ["+ Revenu", "income"]]) {
      await chooseAdd(must(name));
      const modal = await screen.findByRole("region", { name: "Transaction modal" });
      expect(modal.dataset.kind).toBe(kind);
      expect(modal.dataset.id).toBe("");
      fireEvent.click(screen.getByRole("button", { name: "Transaction closed" }));
      expect(screen.queryByRole("region", { name: "Transaction modal" })).toBeNull();
    }
    await chooseAdd("+ Dépense");
    const before = listCalls().length;
    fireEvent.click(await screen.findByRole("button", { name: "Transaction saved" }));
    await screen.findByText(/page 1/);
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    expect(listCalls().at(-1)!.get("page")).toBe("1");
    await chooseAdd("+ Virement");
    fireEvent.click(await screen.findByRole("button", { name: "Transfer closed" }));
    expect(screen.queryByRole("region", { name: "Transfer modal" })).toBeNull();
    await chooseAdd("+ Virement");
    const beforeTransfer = listCalls().length;
    fireEvent.click(await screen.findByRole("button", { name: "Transfer saved" }));
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(beforeTransfer));
    expect(screen.queryByRole("region", { name: "Transfer modal" })).toBeNull();
  });
  it("applies import rules then reloads, and can be dismissed", async () => {
    const { listCalls } = setup({ transactions: [expense] });
    await screen.findAllByText("Synthetic expense");
    fireEvent.click(screen.getByRole("button", { name: "Catégoriser" }));
    fireEvent.click(screen.getByRole("button", { name: "Rules closed" }));
    expect(screen.queryByRole("region", { name: "Rules modal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Catégoriser" }));
    const before = listCalls().length;
    fireEvent.click(screen.getByRole("button", { name: "Rules applied" }));
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    expect(screen.queryByRole("region", { name: "Rules modal" })).toBeNull();
  });
  it("imports with the list space kind, closes, and reloads after success", async () => {
    const { listCalls } = setup({ transactions: [expense] }, "shared");
    await screen.findAllByText("Synthetic expense");
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    expect(screen.getByRole("region", { name: "Import modal" }).dataset.space).toBe("shared");
    fireEvent.click(screen.getByRole("button", { name: "Import closed" }));
    expect(screen.queryByRole("region", { name: "Import modal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    const before = listCalls().length;
    fireEvent.click(screen.getByRole("button", { name: "Import done" }));
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    expect(screen.queryByRole("region", { name: "Import modal" })).toBeNull();
  });
  it("without accounts, disables import and offers to create one, then refreshes accounts", async () => {
    const { fetchMock } = setup({ transactions: [], accounts: [] });
    await screen.findByText("Aucune transaction trouvée.");
    await waitFor(() => expect((screen.getByRole("button", { name: "Importer" }) as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Créer un compte" }));
    fireEvent.click(screen.getByRole("button", { name: "Account closed" }));
    expect(screen.queryByRole("region", { name: "Account modal" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Créer un compte" }));
    const before = fetchMock.mock.calls.filter(([u]) => u === "/api/accounts").length;
    fireEvent.click(screen.getByRole("button", { name: "Account saved" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => u === "/api/accounts").length).toBe(before + 1));
    expect(screen.queryByRole("region", { name: "Account modal" })).toBeNull();
  });
});

describe("TransactionList deletion coverage", () => {
  it("cancels a deletion without sending a request", async () => {
    const { fetchMock } = setup({ transactions: [expense] });
    await screen.findAllByText("Synthetic expense");
    fireEvent.click(within(must(desktopRows()[0])).getByRole("button", { name: "Supprimer" }));
    dialog().getByText("Supprimer cette transaction ?");
    dialog().getByText("« Synthetic expense » sera définitivement supprimée.");
    fireEvent.click(dialog().getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
  });
  it("deletes a transaction by id then reloads the current page", async () => {
    const { fetchMock, listCalls } = setup({ transactions: [expense] });
    await screen.findAllByText("Synthetic expense");
    fireEvent.click(within(cards()).getByRole("button", { name: "Supprimer" }));
    const before = listCalls().length;
    fireEvent.click(dialog().getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/e1", { method: "DELETE" });
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
  });
  it("deletes a transfer pair through the transfer route with its own confirmation", async () => {
    const { fetchMock } = setup({ transactions: [transfer] });
    await screen.findAllByText("Synthetic transfer");
    fireEvent.click(within(must(desktopRows()[0])).getByRole("button", { name: "Supprimer" }));
    dialog().getByText("Supprimer ce virement ?");
    expect(dialog().getByText(/Le virement du .*01\/10\/2026.*50,00.*deux transactions/)).toBeTruthy();
    fireEvent.click(dialog().getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/transfers/tr1", { method: "DELETE" }));
  });
  it.each([["the API message", () => Response.json({ error: "Synthetic delete refusal" }, { status: 409 }), "Synthetic delete refusal"], ["the generic message", () => new Response("<html>", { status: 500 }), "Erreur lors de la suppression"], ["the generic message without an error field", () => Response.json({}, { status: 500 }), "Erreur lors de la suppression"]])("keeps the dialog open with %s, and clears it after cancelling", async (_n, deleteResponse, message) => {
    setup({ transactions: [expense], deleteResponse });
    await screen.findAllByText("Synthetic expense");
    fireEvent.click(within(must(desktopRows()[0])).getByRole("button", { name: "Supprimer" }));
    fireEvent.click(dialog().getByRole("button", { name: "Supprimer" }));
    await screen.findByText(message);
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getAllByText("Synthetic expense").length).toBeGreaterThan(0);
    fireEvent.click(dialog().getByRole("button", { name: "Annuler" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    fireEvent.click(within(must(desktopRows()[0])).getByRole("button", { name: "Supprimer" }));
    expect(screen.queryByText(message)).toBeNull();
    dialog().getByText("« Synthetic expense » sera définitivement supprimée.");
  });
});

describe("TransactionList sharing coverage", () => {
  const shared = (s: unknown) => ({ ...expense, shared_expenses: s });
  it("offers sharing on a plain expense only and reloads after success", async () => {
    const { listCalls } = setup({ transactions: [expense, income, transfer] });
    await screen.findAllByText("Synthetic expense");
    expect(within(must(desktopRows()[0])).getByRole("button", { name: "Partager avec un espace commun" })).toBeTruthy();
    expect(within(must(desktopRows()[1])).queryByRole("button", { name: /Partager|Gérer/ })).toBeNull();
    expect(within(must(desktopRows()[2])).queryByRole("button", { name: /Partager|Gérer/ })).toBeNull();
    fireEvent.click(within(must(desktopRows()[0])).getByRole("button", { name: "Partager avec un espace commun" }));
    expect(JSON.parse(screen.getByRole("region", { name: "Share modal" }).dataset.existing!)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Share closed" }));
    expect(screen.queryByRole("region", { name: "Share modal" })).toBeNull();
    fireEvent.click(within(must(desktopRows()[0])).getByRole("button", { name: "Partager avec un espace commun" }));
    const before = listCalls().length;
    fireEvent.click(screen.getByRole("button", { name: "Share saved" }));
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before));
    expect(screen.queryByRole("region", { name: "Share modal" })).toBeNull();
  });
  it("shows the badge with the space name and manages an existing share with the payer percentage", async () => {
    const share = { id: "s1", space_id: "space1", category_id: cat, paid_by: "payer", shares: { payer: 70, other: 30 } };
    setup({ transactions: [shared([share])] });
    await screen.findAllByText("Synthetic expense");
    await waitFor(() => expect(screen.getAllByText("Partagée · Synthetic space").length).toBeGreaterThan(0));
    fireEvent.click(within(must(desktopRows()[0])).getByRole("button", { name: "Gérer le partage" }));
    expect(JSON.parse(screen.getByRole("region", { name: "Share modal" }).dataset.existing!)).toEqual({ id: "s1", spaceId: "space1", categoryId: cat, payerSharePercent: 70 });
  });
  it("handles an object-shaped share, an unknown space, and a share without a payer", async () => {
    setup({ transactions: [shared({ id: "s2", space_id: "unknown-space", category_id: null })], spaces: [] });
    await screen.findAllByText("Synthetic expense");
    expect(screen.getAllByText("Partagée").length).toBeGreaterThan(0);
    fireEvent.click(within(must(desktopRows()[0])).getByRole("button", { name: "Gérer le partage" }));
    expect(JSON.parse(screen.getByRole("region", { name: "Share modal" }).dataset.existing!)).toEqual({ id: "s2", spaceId: "unknown-space", categoryId: null });
  });
  it.each([[[]], [""]])("treats an empty share (%j) as not shared", async (empty) => {
    setup({ transactions: [shared(empty || null)] });
    await screen.findAllByText("Synthetic expense");
    expect(screen.queryByText(/Partagée/)).toBeNull();
    expect(within(must(desktopRows()[0])).getByRole("button", { name: "Partager avec un espace commun" })).toBeTruthy();
  });
  it("keeps the generic badge when spaces cannot be loaded", async () => {
    setup({ transactions: [shared({ id: "s3", space_id: "space1", category_id: null })], spaces: false as unknown as undefined });
    await screen.findAllByText("Synthetic expense");
    expect(screen.getAllByText("Partagée").length).toBeGreaterThan(0);
  });
  it("in a shared space shows no share control, no badge, and never loads spaces", async () => {
    const { fetchMock } = setup({ transactions: [shared({ id: "s4", space_id: "space1", category_id: null })] }, "shared");
    await screen.findAllByText("Synthetic expense");
    expect(screen.queryByText(/Partagée/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Partager|Gérer/ })).toBeNull();
    expect(fetchMock.mock.calls.some(([u]) => u === "/api/spaces")).toBe(false);
  });
});
