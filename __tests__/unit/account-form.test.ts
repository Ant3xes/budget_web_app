// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { AccountForm } from "@/components/accounts/account-form";
import { LocaleProvider } from "@/components/locale-provider";

const fetchMock = vi.fn();

function mount(props: Parameters<typeof AccountForm>[0] = {}) {
  return render(createElement(LocaleProvider, null, createElement(AccountForm, props)));
}

const balanceInput = () => screen.getByLabelText(/Solde initial/) as HTMLInputElement;

async function submitWith(balance: string | null) {
  fireEvent.change(screen.getByLabelText("Nom"), { target: { value: "Courant" } });
  if (balance !== null) fireEvent.change(balanceInput(), { target: { value: balance } });
  fireEvent.click(screen.getByRole("button", { name: "Créer le compte" }));
}

beforeEach(() => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("AccountForm balance field (issue 103)", () => {
  it("is a text input with decimal keyboard, labelled in euros without « centimes »", () => {
    mount();
    const input = balanceInput();
    expect(input.type).toBe("text");
    expect(input.inputMode).toBe("decimal");
    expect(screen.getByText("Solde initial (€)")).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain("centimes");
  });

  it.each([
    ["12,5", 1250],
    ["12.5", 1250],
    ["1 234,56", 123456],
    ["-50", -5000],
    ["0", 0],
    ["", 0],
  ])("creating with %j sends initialBalanceCents=%j", async (typed, cents) => {
    mount();
    await submitWith(typed);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.initialBalanceCents).toBe(cents);
    expect(body).not.toHaveProperty("initialBalance");
  });

  it("shows an error for « abc » and sends no request", async () => {
    mount();
    await submitWith("abc");
    expect(await screen.findByText(/Montant invalide/)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pre-fills 1999 cents as « 19,99 » and saving untouched sends 1999 again", async () => {
    mount({
      accountId: "a1",
      defaultValues: { name: "Courant", type: "courant", bank: "", initialBalanceCents: 1999, currency: "EUR" },
    });
    expect(balanceInput().value).toBe("19,99");
    fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).initialBalanceCents).toBe(1999);
  });
});
