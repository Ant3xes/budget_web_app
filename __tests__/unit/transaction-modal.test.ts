// @vitest-environment jsdom

import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LocaleProvider } from "@/components/locale-provider";
import { TransactionModal } from "@/components/transactions/transaction-modal";

const accountId = "11111111-1111-4111-8111-111111111111";
const categoryId = "22222222-2222-4222-8222-222222222222";
const otherCategoryId = "33333333-3333-4333-8333-333333333333";

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

function renderEdit() {
  const accounts = deferredResponse();
  const categories = deferredResponse();
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (url === "/api/accounts") return accounts.promise;
    if (url === "/api/categories") return categories.promise;
    return Promise.resolve(Response.json({}));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(createElement(LocaleProvider, null, createElement(TransactionModal, {
    kind: "expense",
    transactionId: "44444444-4444-4444-8444-444444444444",
    defaultValues: {
      account_id: accountId,
      category_id: categoryId,
      amount: "12.34",
      date: "2026-10-01",
      description: "Synthetic transaction",
    },
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  })));
  return {
    fetchMock,
    async loadOptions() {
      await act(async () => {
        accounts.resolve(Response.json({ accounts: [{ id: accountId, name: "Synthetic account" }] }));
        categories.resolve(Response.json({ categories: [
          { id: categoryId, name: "Synthetic category", kind: "expense", icon: null },
          { id: otherCategoryId, name: "Other category", kind: "expense", icon: null },
        ] }));
      });
    },
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TransactionModal (issue 113)", () => {
  it.each([
    ["Compte", accountId],
    ["Catégorie", categoryId],
  ])("preserves the selected %s when options arrive after opening in edit mode", async (label, id) => {
    const { loadOptions } = renderEdit();
    expect(screen.queryByRole("option", { name: "Synthetic account" })).toBeNull();
    await loadOptions();
    expect((screen.getByLabelText(label) as HTMLSelectElement).value).toBe(id);
  });

  it("keeps the original account when only the category is changed and submitted", async () => {
    const { fetchMock, loadOptions } = renderEdit();
    await loadOptions();
    fireEvent.change(screen.getByLabelText("Catégorie"), { target: { value: otherCategoryId } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/transactions/44444444-4444-4444-8444-444444444444",
      expect.objectContaining({ method: "PATCH", body: expect.any(String) }),
    ));
    const request = fetchMock.mock.calls.find(([url]) => url.startsWith("/api/transactions/"));
    expect(JSON.parse((request?.[1] as RequestInit).body as string)).toMatchObject({
      account_id: accountId,
      category_id: otherCategoryId,
    });
  });
});

const accountB = "55555555-5555-4555-8555-555555555555";

function renderTypeEdit(kind: "expense" | "transfer", defaults: Record<string, string>) {
  const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
    if (url === "/api/accounts") return Promise.resolve(Response.json({ accounts: [{ id: accountId, name: "Account A" }, { id: accountB, name: "Account B" }] }));
    if (url === "/api/categories") return Promise.resolve(Response.json({ categories: [{ id: categoryId, name: "Synthetic category", kind: "expense", icon: null }] }));
    return Promise.resolve(Response.json({ ok: true }));
  });
  vi.stubGlobal("fetch", fetchMock);
  render(createElement(LocaleProvider, null, createElement(TransactionModal, {
    kind,
    transactionId: "44444444-4444-4444-8444-444444444444",
    defaultValues: { amount: "10", date: "2026-10-01", description: "Synthetic transaction", ...defaults },
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  })));
  const patchBody = () => {
    const call = fetchMock.mock.calls.find(([url]) => url.startsWith("/api/transactions/"));
    return call ? JSON.parse((call[1] as RequestInit).body as string) : null;
  };
  return { fetchMock, patchBody };
}

describe("TransactionModal type change (issue 115)", () => {
  it("converts an expense to a transfer with source and destination accounts and no category", async () => {
    const { patchBody } = renderTypeEdit("expense", { account_id: accountId, category_id: categoryId });
    await screen.findByRole("option", { name: "Account B" });
    fireEvent.click(screen.getByRole("button", { name: "Virements" }));
    expect(screen.queryByLabelText("Catégorie")).toBeNull();
    fireEvent.change(screen.getByLabelText("Compte destination"), { target: { value: accountB } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await waitFor(() => expect(patchBody()).not.toBeNull());
    expect(patchBody()).toMatchObject({ kind: "transfer", from_account_id: accountId, to_account_id: accountB, category_id: null, amount_cents: 1000 });
    expect(patchBody()).not.toHaveProperty("account_id");
  });

  it("refuses identical source and destination accounts", async () => {
    const { fetchMock } = renderTypeEdit("expense", { account_id: accountId });
    await screen.findByRole("option", { name: "Account B" });
    fireEvent.click(screen.getByRole("button", { name: "Virements" }));
    fireEvent.change(screen.getByLabelText("Compte destination"), { target: { value: accountId } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await screen.findByText("Les comptes source et destination doivent être différents");
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith("/api/transactions/"))).toBe(false);
  });

  it("leaving a transfer requires a category, then a confirmation before sending", async () => {
    const { fetchMock, patchBody } = renderTypeEdit("transfer", { from_account_id: accountId, to_account_id: accountB });
    await screen.findAllByRole("option", { name: "Account B" });
    fireEvent.click(screen.getByRole("button", { name: "Dépenses" }));
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await screen.findByText("Catégorie requise pour quitter le type virement");
    fireEvent.change(screen.getByLabelText("Compte"), { target: { value: accountId } });
    fireEvent.change(screen.getByLabelText("Catégorie"), { target: { value: categoryId } });
    fireEvent.click(screen.getByRole("button", { name: "Mettre à jour" }));
    await screen.findByRole("alert");
    expect(fetchMock.mock.calls.some(([url]) => url.startsWith("/api/transactions/"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirmer et supprimer la ligne miroir" }));
    await waitFor(() => expect(patchBody()).not.toBeNull());
    expect(patchBody()).toMatchObject({ kind: "expense", account_id: accountId, category_id: categoryId, amount_cents: -1000 });
  });
});
