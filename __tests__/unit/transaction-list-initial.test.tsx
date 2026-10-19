// @vitest-environment jsdom
import { StrictMode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { must } from "@/__tests__/helpers/must";
import { LocaleProvider } from "@/components/locale-provider";
import { TransactionList } from "@/components/transactions/transaction-list";
import { initialTransactionFilters, transactionListParams } from "@/lib/transactions/list-filters";
import type { TransactionListInitial } from "@/lib/transactions/list-types";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
const initial: TransactionListInitial = {
  transactions: [{ id: "row", kind: "expense", amount_cents: -1234, currency: "EUR", date: "2026-10-01", description: "Server expense", notes: null, is_imported: false, transfer_id: null, account_id: "account", category_id: null, accounts: { name: "Server account" }, categories: null, to_account: null }],
  total: 51, accounts: [{ id: "account", name: "Server account" }], categories: [], spaceNames: {}, type: "all", categorySelection: "",
};
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Server-preloaded transaction list", () => {
  it("renders the server rows without any mount fetch, including StrictMode, then fetches filters and pagination", async () => {
    const fetchMock = vi.fn(async () => Response.json({ transactions: initial.transactions, total: initial.total }));
    vi.stubGlobal("fetch", fetchMock);
    render(<StrictMode><LocaleProvider><TransactionList initial={initial} /></LocaleProvider></StrictMode>);
    expect(screen.getAllByText("Server expense")).toHaveLength(2);
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(must(screen.getAllByRole("button", { name: "Revenus" })[0]));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/transactions?page=1&per_page=25&kind=income");
    fireEvent.click(must(screen.getAllByRole("button", { name: "Toutes" })[0]));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/transactions?page=1&per_page=25");
    fireEvent.click(screen.getByRole("button", { name: /suiv/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/transactions?page=2&per_page=25");
  });
  it("uses preloaded drill-down filters rather than the navigation mock", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<LocaleProvider><TransactionList initial={{ ...initial, type: "income", categorySelection: "__uncategorized__" }} /></LocaleProvider>);
    expect(must(screen.getAllByLabelText("Catégorie")[0]).getAttribute("aria-label")).toBe("Catégorie");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("maps URL drill-downs and all request filters without losing values", () => {
    expect(initialTransactionFilters("invalid", undefined)).toEqual({ type: "all", categorySelection: "" });
    expect(initialTransactionFilters("transfer", "category")).toEqual({ type: "transfer", categorySelection: "category" });
    const params = transactionListParams({ type: "expense", accountId: "account", categorySelection: "__uncategorized__", dateFrom: "2026-01-01", dateTo: "2026-12-31", q: " query " }, 3);
    expect(Object.fromEntries(params)).toEqual({ page: "3", per_page: "25", kind: "expense", account_id: "account", uncategorized: "true", date_from: "2026-01-01", date_to: "2026-12-31", q: " query " });
  });
});
