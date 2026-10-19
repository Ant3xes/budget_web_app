import { must } from "@/__tests__/helpers/must";
// @vitest-environment jsdom

import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/locale-provider";
import { TransactionList } from "@/components/transactions/transaction-list";

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
// Modals are stubbed: this file only checks which one the list opens and with what.
vi.mock("@/components/transactions/transaction-modal", () => ({
  TransactionModal: (props: { kind: string; transactionId?: string; defaultValues?: Record<string, string> }) =>
    createElement("div", { "data-testid": "tx-modal", "data-kind": props.kind, "data-values": JSON.stringify(props.defaultValues) }),
}));
vi.mock("@/components/transfers/transfer-modal", () => ({ TransferModal: () => createElement("div", { "data-testid": "transfer-modal" }) }));
vi.mock("@/components/transactions/share-transaction-modal", () => ({
  ShareTransactionModal: () => createElement("div", { "data-testid": "share-modal" }),
}));

const acc1 = "11111111-1111-4111-8111-111111111111";
const acc2 = "22222222-2222-4222-8222-222222222222";

const base = {
  currency: "EUR", date: "2026-10-01", notes: null, is_imported: false, category_id: null,
  categories: null, to_account: null, shared_expenses: null,
};
const expense = { ...base, id: "e1", kind: "expense", amount_cents: -1234, description: "Synthetic expense", transfer_id: null, account_id: acc1, accounts: { name: "A" } };
const transfer = {
  ...base, id: "t1", kind: "transfer_debit", amount_cents: -5000, description: "Synthetic transfer", transfer_id: "tr1",
  account_id: acc1, accounts: { name: "A" }, to_account: { id: acc2, name: "B" },
};

function setup() {
  vi.stubGlobal("fetch", vi.fn((url: string) => {
    if (url.startsWith("/api/transactions")) return Promise.resolve(Response.json({ transactions: [expense, transfer], total: 2 }));
    if (url === "/api/accounts") return Promise.resolve(Response.json({ accounts: [] }));
    if (url === "/api/categories") return Promise.resolve(Response.json({ categories: [] }));
    if (url === "/api/spaces") return Promise.resolve(Response.json({ spaces: [] }));
    return Promise.resolve(Response.json({}));
  }));
  render(createElement(LocaleProvider, null, createElement(TransactionList, {})));
}

// jsdom renders both the mobile cards and the desktop table: use the table rows.
const rows = async () => {
  await waitFor(() => expect(screen.getAllByText("Synthetic expense").length).toBeGreaterThan(0));
  return screen.getAllByRole("row").filter((el) => el.tagName === "TR" && el.querySelector("td"));
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TransactionList clickable rows (issue 114)", () => {
  it("opens the modal on row click with the row values", async () => {
    setup();
    const [row] = await rows();
    fireEvent.click(must(row));
    const modal = screen.getByTestId("tx-modal");
    expect(modal.dataset.kind).toBe("expense");
    expect(JSON.parse(modal.dataset.values!)).toMatchObject({ account_id: acc1, amount: "12.34" });
  });

  it("the description is a real button that opens the modal (keyboard and screen reader)", async () => {
    setup();
    const [row] = await rows();
    fireEvent.click(within(must(row)).getByRole("button", { name: "Synthetic expense" }));
    expect(screen.getByTestId("tx-modal")).toBeTruthy();
  });

  it("the row is not itself an interactive role (no nested interactive controls) and the pencil is gone", async () => {
    setup();
    const [row] = await rows();
    expect(must(row).getAttribute("role")).toBeNull();
    expect(must(row).getAttribute("tabindex")).toBeNull();
    expect(screen.queryAllByRole("button", { name: /^(Modifier|Edit)$/ })).toHaveLength(0);
  });

  it("delete button does not open the modal", async () => {
    setup();
    const [row] = await rows();
    fireEvent.click(within(must(row)).getByRole("button", { name: /Supprimer|Delete/ }));
    expect(screen.queryByTestId("tx-modal")).toBeNull();
  });

  it("share button opens the share modal only, not the edit modal", async () => {
    setup();
    const [row] = await rows();
    fireEvent.click(within(must(row)).getByRole("button", { name: /Partager|Share|Gérer|Manage/ }));
    expect(screen.getByTestId("share-modal")).toBeTruthy();
    expect(screen.queryByTestId("tx-modal")).toBeNull();
  });

  it("Enter on the delete button does not open the modal", async () => {
    setup();
    const [row] = await rows();
    fireEvent.keyDown(within(must(row)).getByRole("button", { name: /Supprimer|Delete/ }), { key: "Enter" });
    expect(screen.queryByTestId("tx-modal")).toBeNull();
  });

  it("a transfer row opens TransactionModal with source and destination ids", async () => {
    setup();
    const all = await rows();
    fireEvent.click(must(all[1]));
    const modal = screen.getByTestId("tx-modal");
    expect(modal.dataset.kind).toBe("transfer");
    expect(JSON.parse(modal.dataset.values!)).toMatchObject({ from_account_id: acc1, to_account_id: acc2, amount: "50" });
    expect(screen.queryByTestId("transfer-modal")).toBeNull();
  });
});
