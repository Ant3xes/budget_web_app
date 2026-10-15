// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { ExpenseReimbursements, IncomeReimburses } from "@/components/transactions/reimbursements-section";

const income = { id: "incoming", description: "Synthetic refund", date: "2026-10-02", amount_cents: 6000, currency: "EUR" };
const expense = { ...income, id: "expense", description: "Synthetic purchase", amount_cents: -9000 };
function setup(kind: "expense" | "income", options: { linked?: boolean; candidate?: boolean; fail?: boolean; load?: "failed" | "missing"; currentCandidate?: boolean } = {}) {
  let linked = options.linked ?? false;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      if (options.fail) return Response.json({}, { status: 500 });
      linked = JSON.parse(init.body as string).expense_id !== null;
      return Response.json({});
    }
    if (options.load === "failed") return Response.json({}, { status: 500 });
    if (options.load === "missing") return Response.json({});
    if (url.includes("reimbursement-candidates")) return Response.json({ transactions: options.candidate === false ? [] : kind === "expense" ? (linked ? [] : [income]) : options.currentCandidate ? [expense] : [{ ...expense, id: "other", description: "Other purchase" }] });
    if (url === `/api/transactions/${kind === "expense" ? "expense" : "incoming"}/reimburses`) return Response.json({ reimbursements: linked ? [income] : [], target: linked ? expense : null });
    throw new Error(`Unexpected URL ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  render(<LocaleProvider>{kind === "expense" ? <ExpenseReimbursements expenseId="expense" /> : <IncomeReimburses incomeId="incoming" />}</LocaleProvider>);
  return fetchMock;
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Reimbursement link controls coverage", () => {
  it("adds a refund, displays the total, then removes it and refreshes the choices", async () => {
    const fetchMock = setup("expense");
    const select = await screen.findByRole("combobox");
    expect((screen.getByRole("button", { name: "Lier un remboursement" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(select, { target: { value: income.id } });
    fireEvent.click(screen.getByRole("button", { name: "Lier un remboursement" }));
    await screen.findByText(/Remboursé : 60/);
    expect(screen.getByText("Aucune entrée récente non liée.")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/incoming/reimburses", expect.objectContaining({ method: "PUT", body: JSON.stringify({ expense_id: "expense" }) }));
    fireEvent.click(screen.getByRole("button", { name: "Retirer le lien" }));
    await screen.findByText("Aucun remboursement lié.");
    await screen.findByRole("option", { name: /Synthetic refund/ });
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/incoming/reimburses", expect.objectContaining({ body: JSON.stringify({ expense_id: null }) }));
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
  });
  it("keeps the selected candidate and reports an add error", async () => {
    const fetchMock = setup("expense", { fail: true });
    fireEvent.change(await screen.findByRole("combobox"), { target: { value: income.id } });
    fireEvent.click(screen.getByRole("button", { name: "Lier un remboursement" }));
    await screen.findByText("Impossible de modifier le lien");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(income.id);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT")).toHaveLength(1);
    expect(screen.getByText("Aucun remboursement lié.")).toBeTruthy();
  });
  it("retains an old target outside the candidate window and allows unlinking it", async () => {
    const fetchMock = setup("income", { linked: true });
    await screen.findByRole("option", { name: /Synthetic purchase/ });
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(expense.id);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    await waitFor(() => expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(""));
    expect(screen.queryByRole("option", { name: /Synthetic purchase/ })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("/api/transactions/incoming/reimburses", expect.objectContaining({ body: JSON.stringify({ expense_id: null }) }));
  });
  it("does not duplicate the target already in candidates and keeps it on a failed change", async () => {
    setup("income", { linked: true, currentCandidate: true, fail: true });
    await screen.findByRole("option", { name: /Synthetic purchase/ });
    expect(screen.getAllByRole("option", { name: /Synthetic purchase/ })).toHaveLength(1);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "" } });
    await screen.findByText("Impossible de modifier le lien");
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(expense.id);
  });
  it("links an income to the chosen expense", async () => {
    const fetchMock = setup("income", { currentCandidate: true });
    await screen.findByRole("option", { name: /Synthetic purchase/ });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: expense.id } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/transactions/incoming/reimburses", expect.objectContaining({ body: JSON.stringify({ expense_id: expense.id }) })));
    await waitFor(() => expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe(expense.id));
  });
  it.each(["failed", "missing"] as const)("keeps safe empty states for %s reference responses", async (load) => {
    const fetchMock = setup("expense", { load });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(screen.getByText("Aucun remboursement lié.")).toBeTruthy();
    expect(screen.getByText("Aucune entrée récente non liée.")).toBeTruthy();
    cleanup();
    setup("income", { load });
    await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(1));
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("");
  });
});
