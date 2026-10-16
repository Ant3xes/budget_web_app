// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewCategoryForm } from "@/components/import/new-category-form";
import { LocaleProvider } from "@/components/locale-provider";

const category = { id: "synthetic-created", name: "Synthetic new", kind: "income", icon: null };
function setup(response: () => Promise<Response> = async () => Response.json({ ok: true })) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    if (url !== "/api/categories") throw new Error(`Unexpected URL: ${url}`);
    return init?.method === "POST" ? response() : Promise.resolve(Response.json({ categories: [category] }));
  });
  vi.stubGlobal("fetch", fetchMock);
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(<LocaleProvider><NewCategoryForm kind="income" onCreated={onCreated} onCancel={onCancel} /></LocaleProvider>);
  return { fetchMock, onCreated, onCancel };
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("NewCategoryForm coverage (issue 119)", () => {
  it("rejects a blank name locally, keeps the form open, and lets the user cancel", async () => {
    const { fetchMock, onCreated, onCancel } = setup();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Saisissez un nom de catégorie.");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("submits a trimmed name with Enter, ignores other keys and disables save while creating", async () => {
    let resolve!: (value: Response) => void;
    const pending = new Promise<Response>((done) => { resolve = done; });
    const { fetchMock, onCreated } = setup(() => pending);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "  Synthetic new  " } });
    fireEvent.keyDown(input, { key: "a" });
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect((screen.getByRole("button", { name: "Création…" }) as HTMLButtonElement).disabled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("/api/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Synthetic new", kind: "income" }) });
    await act(async () => resolve(Response.json({ ok: true })));
    expect(onCreated).toHaveBeenCalledWith(category, [category]);
  });

  it.each([
    [409, "Une catégorie portant ce nom existe déjà."],
    [500, "Impossible de créer la catégorie."],
  ])("reports HTTP %s without changing the parent preview", async (status, message) => {
    const { onCreated } = setup(async () => Response.json({}, { status }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Synthetic new" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    expect((await screen.findByRole("alert")).textContent).toBe(message);
    expect(onCreated).not.toHaveBeenCalled();
    expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Synthetic new");
  });

  it("recovers from a rejected network request and allows retry", async () => {
    let attempt = 0;
    const { onCreated } = setup(async () => {
      if (attempt++ === 0) throw new TypeError("Synthetic network failure");
      return Response.json({ ok: true });
    });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Synthetic new" } });
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Impossible de créer la catégorie.");
    fireEvent.click(screen.getByRole("button", { name: "Créer" }));
    await act(async () => {});
    expect(onCreated).toHaveBeenCalledWith(category, [category]);
  });
});
