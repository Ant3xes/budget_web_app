import { must } from "@/__tests__/helpers/must";
// @vitest-environment jsdom
import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { AccountDetail } from "@/components/accounts/account-detail";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
// Charts require layout; expose the actual computed series, not a mocked calculation.
vi.mock("@/components/accounts/balance-chart", () => ({ BalanceChart: ({ data }: { data: unknown }) => <output data-testid="balance-series">{JSON.stringify(data)}</output> }));
vi.mock("@/components/dashboard/bar-chart", () => ({ IncomeExpenseBarChart: ({ data }: { data: unknown }) => <output data-testid="monthly-series">{JSON.stringify(data)}</output> }));
vi.mock("@/components/dashboard/donut-chart", () => ({ DonutChart: ({ data }: { data: unknown }) => <output data-testid="category-series">{JSON.stringify(data)}</output> }));
type ChildProps = { onClose: () => void; onSuccess: () => void; defaultValues?: unknown; defaultAccountId?: string; spaceKind?: string };
vi.mock("@/components/accounts/account-modal", () => ({ AccountModal: (p: ChildProps) => <section aria-label="Account editor" data-values={JSON.stringify(p.defaultValues)}><button onClick={p.onClose}>Close editor</button><button onClick={p.onSuccess}>Save account</button></section> }));
vi.mock("@/components/import/import-modal", () => ({ ImportModal: (p: ChildProps) => <section aria-label="Account import" data-account={p.defaultAccountId} data-space={p.spaceKind}><button onClick={p.onClose}>Close import</button><button onClick={p.onSuccess}>Finish import</button></section> }));

const account = { id: "synthetic-account", name: "Synthetic checking", type: "courant", bank: null, currency: "EUR", initial_balance_cents: 10000, balance_anchor_date: "2026-08-31" };
const category = { name: "Synthetic groceries", color: "#123456", icon: "🍎" };
const tx = { id: "expense", kind: "expense" as const, date: "2026-10-02", description: "Synthetic net purchase", amount_cents: -3000, gross_cents: 9000, currency: "EUR", notes: null, categories: category };
const props: ComponentProps<typeof AccountDetail> = { account, balanceCents: 13000, initialPeriod: "2026-10", allTransactions: [tx, { ...tx, id: "income", kind: "income" as const, description: "Synthetic salary", amount_cents: 10000, gross_cents: undefined, categories: { ...category, icon: null } }, { ...tx, id: "debit", kind: "transfer_debit" as const, description: "Synthetic outgoing", amount_cents: -2000, gross_cents: undefined, categories: null }, { ...tx, id: "credit", kind: "transfer_credit" as const, description: "Synthetic incoming", amount_cents: 2000, gross_cents: undefined, categories: null }, { ...tx, id: "old", date: "2026-09-01", description: "Previous purchase" }, { ...tx, id: "future", date: "2026-11-01", description: "Future purchase" }], balanceTxs: [{ date: "2026-10-02", amount_cents: 3000 }, { date: "2026-09-01", amount_cents: -1000 }, { date: "2026-10-03", amount_cents: 1000 }], incomeExpenseData: [{ key: "2026-09", month: "septembre 2026", income: 1000, expense: 2000 }, { key: "2026-10", month: "octobre 2026", income: 10000, expense: 3000 }], expenseHistory: [{ date: "2026-10-02", amount_cents: -3000, categoryName: category.name, categoryColor: category.color }, { date: "2026-09-01", amount_cents: -9000, categoryName: "Previous category", categoryColor: null }] };
function setup(overrides: Partial<typeof props> = {}) { return render(<LocaleProvider><AccountDetail {...props} {...overrides} /></LocaleProvider>); }
const series = (id: string) => JSON.parse(screen.getByTestId(id).textContent!);
beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-15T12:00:00Z")); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Account detail coverage", () => {
  it("shows the same period in charts and lists, preserving net/gross notes and transfer directions on mobile and desktop", () => {
    setup();
    expect(screen.getByRole("heading", { name: account.name })).toBeTruthy();
    expect(screen.getByText("Courant")).toBeTruthy();
    expect(screen.getAllByText(/30,00.*sur.*90,00/)).toHaveLength(2);
    expect(screen.getAllByText("Entrant")).toHaveLength(2);
    expect(screen.getAllByText("Sortant")).toHaveLength(2);
    expect(screen.queryByText("Previous purchase")).toBeNull();
    expect(screen.queryByText("Future purchase")).toBeNull();
    expect(series("balance-series")[0]).toMatchObject({ date: "2026-10-01", balance: 9000 });
    expect(series("balance-series").at(-1)).toMatchObject({ date: "2026-10-15", balance: 13000 });
    expect(series("monthly-series")).toEqual([props.incomeExpenseData[1]]);
    expect(series("category-series")).toEqual([expect.objectContaining({ name: category.name, value: 3000 })]);
  });
  it("switches every preset and restores the current-month URL without a query", () => {
    setup();
    for (const [label, value] of [["3 mois", "3m"], ["6 mois", "6m"], ["1 an", "1a"], ["2 ans", "2a"], ["Tout", "tout"]]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
      expect(window.location.search).toBe(`?period=${value}`);
      expect(screen.getAllByText("Previous purchase")).toHaveLength(2);
      expect(series("monthly-series")).toEqual(props.incomeExpenseData);
    }
    expect(series("balance-series")[0].date).toBe("2026-09-01");
    fireEvent.click(screen.getByRole("button", { name: "Ce mois" }));
    expect(window.location.pathname).toBe(`/accounts/${account.id}`);
    expect(window.location.search).toBe("");
    expect(screen.queryByText("Previous purchase")).toBeNull();
  });
  it("navigates months, handles a month with no aggregate, and accepts a picker change", () => {
    const { container } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Mois précédent" }));
    expect(window.location.search).toBe("?period=2026-09");
    expect(series("monthly-series")).toEqual([props.incomeExpenseData[0]]);
    expect(screen.getAllByText("Previous purchase")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Mois suivant" }));
    expect(window.location.search).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Mois suivant" }));
    expect(series("monthly-series")).toEqual([{ key: "2026-11", month: "novembre 2026", income: 0, expense: 0 }]);
    const input = container.querySelector('input[type="month"]')!;
    fireEvent.change(input, { target: { value: "" } });
    expect(window.location.search).toBe("?period=2026-11");
    fireEvent.change(input, { target: { value: "2026-09" } });
    expect(window.location.search).toBe("?period=2026-09");
    fireEvent.click(screen.getByRole("button", { name: "3 mois" }));
    fireEvent.click(screen.getByRole("button", { name: "octobre 2026" }));
    expect(window.location.search).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Choisir un mois" }));
    expect(document.activeElement).toBe(input);
    const showPicker = vi.fn();
    Object.defineProperty(input, "showPicker", { configurable: true, value: showPicker });
    fireEvent.click(screen.getByRole("button", { name: "Choisir un mois" }));
    expect(showPicker).toHaveBeenCalledOnce();
  });
  it("paginates ten operations, sorts equal dates by id, and clamps the page after narrowing the period", () => {
    const transactions = Array.from({ length: 12 }, (_, i) => ({ ...tx, id: `e${String(i).padStart(2, "0")}`, description: `Synthetic purchase ${i}`, gross_cents: undefined, categories: i % 2 ? category : null, date: i < 2 ? "2026-09-01" : "2026-10-02" }));
    setup({ initialPeriod: "3m", allTransactions: transactions });
    const table = screen.getAllByRole("table")[0];
    expect(within(must(table)).getAllByRole("row")).toHaveLength(11);
    expect(must(within(must(table)).getAllByRole("row")[1]).textContent).toContain("Synthetic purchase 11");
    fireEvent.click(screen.getByRole("button", { name: /Suiv/ }));
    expect(screen.getAllByText("Synthetic purchase 0")).toHaveLength(2);
    expect(screen.queryByText("Synthetic purchase 11")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ce mois" }));
    expect(screen.getAllByText("Synthetic purchase 11")).toHaveLength(2);
    expect(screen.queryByText("Synthetic purchase 0")).toBeNull();
    expect(screen.queryByRole("button", { name: /Suiv/ })).toBeNull();
  });
  it("renders empty states and a custom account type with a negative balance", () => {
    setup({ account: { ...account, type: "Synthetic custom" }, balanceCents: -100, initialPeriod: "tout", allTransactions: [], balanceTxs: [], incomeExpenseData: [], expenseHistory: [] });
    expect(screen.getByText("Synthetic custom")).toBeTruthy();
    expect(screen.getByText(/-1,00/).className).toContain("text-expense");
    for (const label of ["Aucune dépense sur cette période", "Aucun revenu sur cette période", "Aucun virement sur cette période"]) expect(screen.getByText(label)).toBeTruthy();
    expect(series("monthly-series")).toEqual([]);
    expect(series("category-series")).toEqual([]);
    expect(series("balance-series")).toEqual([expect.objectContaining({ date: "2026-10-15", balance: 10000 })]);
  });
  it("opens the editor with saved values and refreshes only after success", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Modifier" }));
    const editor = await screen.findByRole("region", { name: "Account editor" });
    expect(JSON.parse(editor.dataset.values!)).toMatchObject({ name: account.name, bank: "", initialBalanceCents: 10000 });
    fireEvent.click(screen.getByRole("button", { name: "Close editor" }));
    expect(screen.queryByRole("region", { name: "Account editor" })).toBeNull();
    expect(router.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Modifier" }));
    fireEvent.click(await screen.findByRole("button", { name: "Save account" }));
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region", { name: "Account editor" })).toBeNull();
  });
  it("preselects the account for shared imports, handles cancel and refreshes after import", () => {
    render(<LocaleProvider><AccountDetail {...props} spaceKind="shared" account={{ ...account, bank: "Synthetic bank" }} /></LocaleProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    const modal = screen.getByRole("region", { name: "Account import" });
    expect(modal.dataset.account).toBe(account.id);
    expect(modal.dataset.space).toBe("shared");
    fireEvent.click(screen.getByRole("button", { name: "Close import" }));
    expect(router.refresh).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    fireEvent.click(screen.getByRole("button", { name: "Finish import" }));
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(screen.queryByRole("region", { name: "Account import" })).toBeNull();
  });
  it("cancels deletion without a request, then deletes the account and returns to the list", async () => {
    const fetchMock = vi.fn(async () => Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Annuler" }));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Options" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Supprimer" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Supprimer" }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/accounts"));
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("/api/accounts", expect.objectContaining({ method: "DELETE", body: JSON.stringify({ id: account.id }) }));
  });
});
