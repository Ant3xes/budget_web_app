import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));

import { createChainableMock } from "@/__tests__/mocks/supabase";
import { POST as createAccount } from "@/app/api/accounts/route";
import { POST as createBudget } from "@/app/api/budgets/route";
import { POST as createCategory } from "@/app/api/categories/route";
import { POST as createGoal } from "@/app/api/savings-goals/route";
import { POST as createInvitation } from "@/app/api/invitations/route";
import { POST as createTransaction } from "@/app/api/transactions/route";
import { POST as createTransfer } from "@/app/api/transfers/route";
import { PATCH as patchProfile } from "@/app/api/profile/route";
import { PATCH as patchTransaction } from "@/app/api/transactions/[id]/route";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { withSpace } from "@/lib/spaces/with-space";

const ACCOUNT = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const ACCOUNT_2 = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12";
const CATEGORY = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
const TX_ID = "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

const json = (body: unknown) =>
  new Request("http://localhost/api/x", { method: "POST", body: JSON.stringify(body) });

function authed(error: unknown = null, data: unknown = null) {
  const chain = createChainableMock({ data, error });
  const from = vi.fn(() => chain);
  vi.mocked(withSpace).mockResolvedValue({
    supabase: { from },
    user: { id: "u" },
    spaceId: "s",
    space: { id: "s", kind: "shared", name: "n", role: "owner" },
    spaces: [],
    isDemo: false,
  } as never);
  return { from, chain };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("input validation: amounts beyond the 32-bit column", () => {
  const base = { account_id: ACCOUNT, kind: "expense", date: "2026-01-15", description: "x" };

  it("rejects a transaction above 2 147 483 647 cents without touching the database", async () => {
    const { from } = authed();
    const res = await createTransaction(json({ ...base, amount_cents: 2_147_483_648 }));
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("still accepts the maximum storable amount", async () => {
    authed();
    const res = await createTransaction(json({ ...base, amount_cents: 2_147_483_647 }));
    expect(res.status).toBe(200);
  });

  it("rejects oversized amounts on PATCH, transfers, budgets and goals", async () => {
    // The PATCH route looks the row up first, so give it one to find.
    const { from } = authed(null, { kind: "expense", transfer_id: null });
    const big = 9_999_999_999;
    const results = await Promise.all([
      patchTransaction(
        new Request("http://localhost/x", { method: "PATCH", body: JSON.stringify({ amount_cents: big }) }),
        { params: Promise.resolve({ id: TX_ID }) },
      ),
      createTransfer(json({ from_account_id: ACCOUNT, to_account_id: ACCOUNT_2, amount_cents: big, date: "2026-01-15" })),
      createBudget(json({ category_id: CATEGORY, month: "2026-01", amount_cents: big })),
      createGoal(json({ name: "g", target_amount_cents: big })),
    ]);
    expect(results.map((r) => r.status)).toEqual([400, 400, 400, 400]);
    // Only the PATCH lookup (a read) may have happened: nothing was written.
    expect((from.mock.calls as unknown as string[][]).every(([table]) => table === "transactions")).toBe(true);
  });
});

describe("input validation: calendar dates and months", () => {
  const base = { account_id: ACCOUNT, kind: "expense", amount_cents: 100, description: "x" };

  it.each(["2026-13-45", "2026-02-30", "2025-02-29"])("rejects the impossible date %s", async (date) => {
    const { from } = authed();
    const res = await createTransaction(json({ ...base, date }));
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an impossible date on transfers", async () => {
    const { from } = authed();
    const res = await createTransfer(
      json({ from_account_id: ACCOUNT, to_account_id: ACCOUNT_2, amount_cents: 100, date: "2026-00-10" }),
    );
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects month 13 for a budget", async () => {
    const { from } = authed();
    const res = await createBudget(json({ category_id: CATEGORY, month: "2026-13", amount_cents: 100 }));
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("input validation: colors, emails, passwords, account balance", () => {
  it("rejects a non-hex category color (no CSS smuggled into style attributes)", async () => {
    const { from } = authed();
    const res = await createCategory(json({ name: "x", kind: "expense", color: "red;background:url(//evil)" }));
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a non-hex goal color", async () => {
    const { from } = authed();
    const res = await createGoal(json({ name: "g", target_amount_cents: 100, color: "javascript:alert(1)" }));
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an invitation email longer than 254 characters", async () => {
    const { from } = authed();
    const res = await createInvitation(json({ email: `${"a".repeat(250)}@example.com` }));
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an opening balance above the integer column", async () => {
    const { from } = authed();
    const res = await createAccount(
      json({ name: "Courant", type: "courant", initialBalanceCents: 2_147_483_648, currency: "EUR" }),
    );
    expect(res.status).toBe(400);
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a new password longer than 72 characters before any auth call", async () => {
    const signIn = vi.fn();
    const updateUser = vi.fn();
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u", email: "a@b.c" } } }),
        signInWithPassword: signIn,
        updateUser,
      },
      rpc: vi.fn().mockResolvedValue({ data: false, error: null }),
    } as never);
    const long = "a".repeat(73);
    const res = await patchProfile(
      new Request("http://localhost/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ current_password: "oldpass1", new_password: long, confirm: long }),
      }),
    );
    expect(res.status).toBe(400);
    expect(signIn).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });
});

describe("raw database errors are never echoed to the client", () => {
  const leaky = {
    code: "42P01",
    message: 'relation "internal_secret_table" does not exist at character 15',
  };

  it("POST /api/transactions returns a generic message and keeps details in the server log", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    authed(leaky);
    const res = await createTransaction(
      json({ account_id: ACCOUNT, kind: "expense", amount_cents: 100, date: "2026-01-15", description: "x" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toEqual({ error: "Request failed" });
    expect(JSON.stringify(body)).not.toContain("internal_secret_table");
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("maps a unique violation to 409 and an RLS denial to 403 (business outcomes)", async () => {
    authed({ code: "23505", message: "duplicate" });
    const duplicate = await createCategory(json({ name: "x", kind: "expense" }));
    expect(duplicate.status).toBe(409);

    authed({ code: "42501", message: "new row violates row-level security policy" });
    const denied = await createCategory(json({ name: "x", kind: "expense" }));
    expect(denied.status).toBe(403);
  });
});
