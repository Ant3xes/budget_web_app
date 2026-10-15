// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { TransactionModal } from "@/components/transactions/transaction-modal";

const a = "11111111-1111-4111-8111-111111111111";
const b = "55555555-5555-4555-8555-555555555555";
const expenseCat = "22222222-2222-4222-8222-222222222222";
const incomeCat = "33333333-3333-4333-8333-333333333333";
type Kind = "expense" | "income" | "transfer";
type Options = { transactionId?: string; defaults?: Record<string, string>; rawLabel?: string | null; save?: () => Response | Promise<Response>; refs?: "failed" | "missing" };

function setup(kind: Kind, options: Options = {}) {
  const onClose = vi.fn();
  const onSuccess = vi.fn();
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST" || init?.method === "PATCH") return options.save ? options.save() : Response.json({ ok: true });
    if (options.refs === "failed") return Response.json({}, { status: 500 });
    if (options.refs === "missing") return Response.json({});
    if (url === "/api/accounts") return Response.json({ accounts: [{ id: a, name: "Account A" }, { id: b, name: "Account B" }] });
    if (url === "/api/categories") return Response.json({ categories: [
      { id: expenseCat, name: "Synthetic expense category", kind: "expense", icon: "🛒" },
      { id: incomeCat, name: "Synthetic income category", kind: "income", icon: null },
    ] });
    return Response.json({ reimbursements: [], target: null, transactions: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<LocaleProvider><TransactionModal kind={kind} transactionId={options.transactionId} defaultValues={options.defaults} rawLabel={options.rawLabel} onClose={onClose} onSuccess={onSuccess} /></LocaleProvider>);
  const request = (method = "POST") => {
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === method);
    return call ? { url: call[0], body: JSON.parse((call[1] as RequestInit).body as string) } : null;
  };
  return { fetchMock, onClose, onSuccess, request };
}
const type = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const fillBase = () => { type("Montant (€)", "12,50"); type("Date", "2026-10-03"); type("Description", "  Synthetic label  "); };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

describe("TransactionModal creation coverage", () => {
  it("creates an expense with a signed amount, selected category and notes", async () => {
    const { request, onSuccess } = setup("expense");
    await flush();
    expect(screen.queryByRole("group", { name: "Type" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Nouvelle dépense" })).toBeTruthy();
    type("Compte", a); fillBase(); type("Catégorie", expenseCat); type("Notes", "Synthetic note");
    expect(screen.getByRole("option", { name: /🛒 Synthetic expense category/ })).toBeTruthy();
    expect(screen.queryByRole("option", { name: /income category/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(request()).toEqual({ url: "/api/transactions", body: { account_id: a, amount_cents: -1250, date: "2026-10-03", description: "Synthetic label", category_id: expenseCat, notes: "Synthetic note", kind: "expense" } });
  });
  it("creates an income with a positive amount and null optional fields", async () => {
    const { request, onSuccess } = setup("income");
    await flush();
    expect(screen.getByRole("dialog", { name: "Nouveau revenu" })).toBeTruthy();
    type("Compte", a); fillBase(); type("Catégorie", incomeCat);
    expect(screen.queryByRole("option", { name: /Synthetic expense category/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(request()?.body).toMatchObject({ account_id: a, amount_cents: 1250, category_id: incomeCat, notes: null });
  });
  it("creates a transfer between two accounts without account or category fields", async () => {
    const { request, onSuccess } = setup("transfer");
    await flush();
    expect(screen.getByRole("dialog", { name: "Nouveau virement" })).toBeTruthy();
    expect(screen.queryByLabelText("Catégorie")).toBeNull();
    type("Compte source", a); type("Compte destination", b); fillBase();
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(request()?.body).toEqual({ kind: "transfer", from_account_id: a, to_account_id: b, amount_cents: 1250, date: "2026-10-03", description: "Synthetic label", category_id: null, notes: null });
  });
  it("defaults the date to today and shows validation messages without sending", async () => {
    const { fetchMock } = setup("expense");
    await flush();
    expect((screen.getByLabelText("Date") as HTMLInputElement).value).toBe(new Date().toISOString().slice(0, 10));
    type("Montant (€)", "abc"); type("Date", "2026-13"); type("Description", "   ");
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    for (const message of ["Compte requis", "Montant invalide", "Date invalide", "Description requise"]) await screen.findByText(message);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method)).toBe(false);
  });
  it("requires both transfer accounts", async () => {
    setup("transfer");
    await flush();
    fillBase();
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await screen.findByText("Compte source requis");
    expect(screen.getByText("Compte destination requis")).toBeTruthy();
  });
  it("closes with Cancel and the modal close control", async () => {
    const { onClose } = setup("expense");
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it.each(["failed", "missing"] as const)("opens with empty choices when references are %s", async (refs) => {
    setup("expense", { refs });
    await flush();
    expect(screen.getAllByRole("option", { name: "— Sélectionner —" })).toHaveLength(1);
    expect(screen.queryByRole("option", { name: "Account A" })).toBeNull();
  });
});

describe("TransactionModal edit coverage", () => {
  const edit = { transactionId: "44444444-4444-4444-8444-444444444444" };
  it("shows the raw bank label and the edit title, and omits the kind while the type is unchanged", async () => {
    const { request, onSuccess } = setup("income", { ...edit, rawLabel: "SYNTHETIC RAW LABEL", defaults: { account_id: a, amount: "10", date: "2026-10-01", description: "Clean label", category_id: incomeCat } });
    await flush();
    expect(screen.getByRole("dialog", { name: "Modifier le revenu" })).toBeTruthy();
    expect(screen.getByText("Libellé bancaire d'origine")).toBeTruthy();
    expect(screen.getByText("SYNTHETIC RAW LABEL")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(request("PATCH")?.body).not.toHaveProperty("kind");
  });
  it("shows income reimbursement control and omits the raw label when none is given", async () => {
    setup("income", { ...edit, defaults: { account_id: a, amount: "10", date: "2026-10-01", description: "Clean label" } });
    await flush();
    expect(screen.queryByText("Libellé bancaire d'origine")).toBeNull();
    expect(screen.getByText("Rembourse la dépense…")).toBeTruthy();
  });
  it("converts an income to a transfer seeding the destination account, then back to an income", async () => {
    const { request, onSuccess } = setup("income", { ...edit, defaults: { account_id: a, amount: "10", date: "2026-10-01", description: "Synthetic", category_id: incomeCat } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Virements" }));
    expect((screen.getByLabelText("Compte destination") as HTMLSelectElement).value).toBe(a);
    expect((screen.getByLabelText("Compte source") as HTMLSelectElement).value).toBe("");
    expect(screen.getByRole("dialog", { name: "Modifier le virement" })).toBeTruthy();
    expect(screen.queryByText("Rembourse la dépense…")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Virements" })); // same type: no-op
    type("Compte source", b);
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(request("PATCH")?.body).toMatchObject({ kind: "transfer", from_account_id: b, to_account_id: a, category_id: null });
  });
  it("converts a transfer to an income using the source account and asks for no extra confirmation after Revenus is re-selected", async () => {
    const { request, onSuccess } = setup("transfer", { ...edit, defaults: { from_account_id: a, to_account_id: b, amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Revenus" }));
    expect((screen.getByLabelText("Compte") as HTMLSelectElement).value).toBe(a);
    type("Catégorie", incomeCat);
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await screen.findByRole("alert");
    // Changing type cancels the pending confirmation.
    fireEvent.click(screen.getByRole("button", { name: "Dépenses" }));
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Revenus" }));
    type("Catégorie", incomeCat);
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    fireEvent.click(await screen.findByRole("button", { name: "Confirmer et supprimer la ligne miroir" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(request("PATCH")?.body).toMatchObject({ kind: "income", account_id: a, category_id: incomeCat, amount_cents: 1000 });
  });
  it("converts a transfer to an expense using the destination when no source is saved", async () => {
    setup("transfer", { ...edit, defaults: { to_account_id: b, amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Dépenses" }));
    expect((screen.getByLabelText("Compte") as HTMLSelectElement).value).toBe(b);
  });
  it("leaves the account empty when a transfer without any saved side becomes an expense", async () => {
    setup("transfer", { ...edit, defaults: { amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Dépenses" }));
    expect((screen.getByLabelText("Compte") as HTMLSelectElement).value).toBe("");
  });
  it("keeps an account already chosen when leaving a transfer", async () => {
    setup("transfer", { ...edit, defaults: { account_id: a, to_account_id: b, amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Dépenses" }));
    expect((screen.getByLabelText("Compte") as HTMLSelectElement).value).toBe(a);
  });
  it("does not seed an expense-turned-transfer when the transfer sides are already chosen", async () => {
    setup("expense", { ...edit, defaults: { account_id: a, from_account_id: b, amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Virements" }));
    expect((screen.getByLabelText("Compte source") as HTMLSelectElement).value).toBe(b);
    expect((screen.getByLabelText("Compte destination") as HTMLSelectElement).value).toBe("");
  });
  it("converts an expense without any account without seeding either side", async () => {
    setup("expense", { ...edit, defaults: { amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Virements" }));
    expect((screen.getByLabelText("Compte source") as HTMLSelectElement).value).toBe("");
    expect((screen.getByLabelText("Compte destination") as HTMLSelectElement).value).toBe("");
  });
  it("titles an edited expense and hides reimbursement links while its type is changed", async () => {
    setup("expense", { ...edit, defaults: { account_id: a, amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    expect(screen.getByRole("dialog", { name: "Modifier la dépense" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Remboursements" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Revenus" }));
    expect(screen.queryByRole("region", { name: "Remboursements" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Modifier le revenu" })).toBeTruthy();
  });
});

describe("TransactionModal save feedback coverage", () => {
  it.each([["created", "Règle créée pour ce libellé"], ["updated", "Règle mise à jour pour ce libellé"]])("shows the %s rule message, locks submit and calls onSuccess after a delay", async (rule, message) => {
    const { onSuccess } = setup("expense", { save: () => Response.json({ rule }), transactionId: "44444444-4444-4444-8444-444444444444", defaults: { account_id: a, amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    expect((await screen.findByRole("status")).textContent).toBe(message);
    expect((screen.getByRole("button", { name: "Mettre à jour" }) as HTMLButtonElement).disabled).toBe(true);
    expect(onSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce(), { timeout: 3000 });
  });
  it("calls onSuccess immediately when the response has no JSON rule", async () => {
    const { onSuccess } = setup("expense", { save: () => new Response("not json"), defaults: { account_id: a, amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(screen.queryByRole("status")).toBeNull();
  });
  it.each([["API message", { error: "Synthetic API failure" }, "Synthetic API failure"], ["generic message", {}, "Impossible de sauvegarder"]])("keeps the modal open and shows the %s", async (_name, payload, message) => {
    const { onSuccess } = setup("expense", { save: () => Response.json(payload, { status: 400 }), defaults: { account_id: a, amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await screen.findByText(message);
    expect(onSuccess).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Créer" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("shows Sauvegarde… while a save is pending", async () => {
    let finish!: (r: Response) => void;
    const { onSuccess } = setup("expense", { save: () => new Promise<Response>((resolve) => { finish = resolve; }), defaults: { account_id: a, amount: "10", date: "2026-10-01", description: "Synthetic" } });
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    const saving = await screen.findByRole("button", { name: /Sauvegarde/ });
    expect((saving as HTMLButtonElement).disabled).toBe(true);
    await act(async () => finish(Response.json({})));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  });
});
