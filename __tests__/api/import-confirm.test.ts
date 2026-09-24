import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));

import { withSpace } from "@/lib/spaces/with-space";
import { POST } from "@/app/api/import/confirm/route";
import { createChainableMock } from "@/__tests__/mocks/supabase";

const mockUser = { id: "user-test-id", email: "test@budget.local" };

const asAuth = (supabase: unknown) =>
  ({
    supabase,
    user: mockUser,
    spaceId: "space-test-id",
    space: { id: "space-test-id", name: "Personnel", kind: "personal", role: "owner" },
    spaces: [
      { id: "space-test-id", name: "Personnel", kind: "personal", role: "owner" },
      { id: SHARED_ID, name: "Colocation", kind: "shared", role: "member" },
    ],
  }) as never;
const SHARED_ID = "00000000-0000-4000-8000-0000000000aa";
const OTHER_SHARED_ID = "00000000-0000-4000-8000-0000000000bb";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "00000000-0000-4000-8000-000000000002";
const COUNTERPART_ACCOUNT_ID = "00000000-0000-4000-8000-000000000003";

function buildSupabaseMock(
  rpcResult: { data?: unknown; error: null | { message: string; code?: string } } = { error: null },
  spaceAccountIds: string[] = [ACCOUNT_ID, COUNTERPART_ACCOUNT_ID],
) {
  const queryBuilder = createChainableMock({ data: null, error: null });
  // Like the SQL function: returns the number of imported lines it inserted
  // (unless the test forces a result).
  const rpc = vi.fn((_fn: string, args: { p_rows: { is_imported?: boolean }[] }) =>
    Promise.resolve("data" in rpcResult || rpcResult.error ? rpcResult : { data: args.p_rows.filter((r) => r.is_imported).length, error: null }),
  );
  // Members / default split of the shared space, loaded when a line is shared.
  const membersBuilder = createChainableMock({ data: [{ user_id: mockUser.id }, { user_id: "other-user" }], error: null });
  const spacesBuilder = createChainableMock({ data: { default_share_percent: 50 }, error: null });
  // The route first checks the accounts it was given against the active space.
  const accountsBuilder = createChainableMock({ data: spaceAccountIds.map((id) => ({ id })), error: null });
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      rpc,
      from: vi.fn((table: string) =>
        table === "accounts"
          ? accountsBuilder
          : table === "space_members"
            ? membersBuilder
            : table === "spaces"
              ? spacesBuilder
              : queryBuilder,
      ),
    },
    rpc,
    queryBuilder,
    membersBuilder,
    spacesBuilder,
    accountsBuilder,
  };
}

const rpcArgs = (rpc: ReturnType<typeof vi.fn>) =>
  rpc.mock.calls[0]?.[1] as { p_rows: Record<string, unknown>[]; p_shares: Record<string, unknown>[] };

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/import/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/import/confirm — auth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);

    const res = await POST(makeRequest({}));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });
});

describe("POST /api/import/confirm — Zod validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const { supabase } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));
  });

  it("returns 400 when account_id is missing", async () => {
    const res = await POST(makeRequest({ transactions: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when account_id is not a valid UUID", async () => {
    const res = await POST(makeRequest({ account_id: "not-a-uuid", transactions: [] }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/uuid|guid/i);
  });

  it("returns 400 when transactions array is empty", async () => {
    const res = await POST(makeRequest({ account_id: ACCOUNT_ID, transactions: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when a transaction has invalid date format", async () => {
    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{
        hash: "abc",
        date: "15-01-2026",          // wrong format — must be YYYY-MM-DD
        description: "Test",
        amount_cents: -1000,
        kind: "expense",
      }],
    }));
    expect(res.status).toBe(400);
    // date error in nested path
    const body = (await res.json()) as { error: string };
    expect(body.error).toBeTruthy();
  });

  it("returns 400 when category_id is present but not a valid UUID", async () => {
    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{
        hash: "abc",
        date: "2026-01-15",
        description: "Netflix",
        amount_cents: -1599,
        kind: "expense",
        category_id: "invalid-uuid",
      }],
    }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/category_id/i);
  });

  it("returns 400 when kind is not a valid enum value", async () => {
    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{
        hash: "abc",
        date: "2026-01-15",
        description: "Test",
        amount_cents: -1000,
        kind: "debit",               // invalid — must be expense | income | transfer
      }],
    }));
    expect(res.status).toBe(400);
  });
});

describe("POST /api/import/confirm — success paths", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts an account id that is not RFC v4 (the dev seed uses b0000000-0000-0000-0000-…)", async () => {
    const seedAccountId = "b0000000-0000-0000-0000-000000000001";
    const { supabase, rpc } = buildSupabaseMock({ error: null }, [seedAccountId]);
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({
      account_id: seedAccountId,
      transactions: [{ hash: "h", date: "2026-01-15", description: "Netflix", amount_cents: -1599, kind: "expense" }],
    }));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("sends 1 row for a valid expense and returns imported count", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{
        hash: "hash-abc",
        date: "2026-01-15",
        description: "Netflix",
        amount_cents: -1599,
        kind: "expense",
        category_id: CATEGORY_ID,
      }],
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; imported: number };
    expect(body.ok).toBe(true);
    expect(body.imported).toBe(1);

    // Verify 1 row was inserted
    const inserted = rpcArgs(rpc).p_rows;
    expect(inserted).toHaveLength(1);
    expect((inserted[0] as Record<string, unknown>).kind).toBe("expense");
    expect((inserted[0] as Record<string, unknown>).is_imported).toBe(true);
    expect((inserted[0] as Record<string, unknown>).space_id).toBe("space-test-id");
    expect((inserted[0] as Record<string, unknown>).user_id).toBe("user-test-id");
  });

  it("sends 1 row for a valid income", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{
        hash: "hash-income",
        date: "2026-01-10",
        description: "Employeur SA",
        amount_cents: 250000,
        kind: "income",
        category_id: null,
      }],
    }));

    expect(res.status).toBe(200);
    const inserted = rpcArgs(rpc).p_rows;
    expect(inserted).toHaveLength(1);
    expect((inserted[0] as Record<string, unknown>).kind).toBe("income");
    expect((inserted[0] as Record<string, unknown>).amount_cents).toBe(250000);
  });

  it("sends 1 row for transfer WITHOUT counterpart account (no mirror)", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{
        hash: "hash-transfer",
        date: "2026-01-20",
        description: "Virement SEPA",
        amount_cents: -50000,
        kind: "transfer",
        transfer_account_id: null,
      }],
    }));

    expect(res.status).toBe(200);
    const inserted = rpcArgs(rpc).p_rows;
    expect(inserted).toHaveLength(1);                              // no mirror
    expect((inserted[0] as Record<string, unknown>).kind).toBe("transfer_debit");
    expect((inserted[0] as Record<string, unknown>).transfer_id).toBeNull();
  });

  it("sends 2 rows for transfer WITH counterpart account (main + mirror)", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{
        hash: "hash-transfer-pair",
        date: "2026-01-20",
        description: "Virement compte épargne",
        amount_cents: -30000,
        kind: "transfer",
        transfer_account_id: COUNTERPART_ACCOUNT_ID,
      }],
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; imported: number };
    expect(body.imported).toBe(1);                                 // only original counted

    const inserted = rpcArgs(rpc).p_rows;
    expect(inserted).toHaveLength(2);

    const main = inserted[0] as Record<string, unknown>;
    expect(main.space_id).toBe("space-test-id");
    expect((inserted[1] as Record<string, unknown>).space_id).toBe("space-test-id");
    const mirror = inserted[1] as Record<string, unknown>;

    expect(main.kind).toBe("transfer_debit");
    expect(main.account_id).toBe(ACCOUNT_ID);
    expect(main.amount_cents).toBe(-30000);
    expect(main.is_imported).toBe(true);
    expect(main.transfer_id).toBeTruthy();

    expect(mirror.kind).toBe("transfer_credit");
    expect(mirror.account_id).toBe(COUNTERPART_ACCOUNT_ID);
    expect(mirror.amount_cents).toBe(30000);                       // opposite sign
    expect(mirror.is_imported).toBe(false);
    expect(mirror.transfer_id).toBe(main.transfer_id);            // shared transfer_id
  });

  it("deducts category_id for transfers (always null)", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{
        hash: "hash-tr",
        date: "2026-01-20",
        description: "Virement",
        amount_cents: -1000,
        kind: "transfer",
        category_id: CATEGORY_ID,    // should be ignored for transfers
        transfer_account_id: null,
      }],
    }));

    const inserted = rpcArgs(rpc).p_rows;
    expect((inserted[0] as Record<string, unknown>).category_id).toBeNull();
  });

  it("handles multiple transactions in one batch", async () => {
    const { supabase } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [
        { hash: "h1", date: "2026-01-01", description: "Lidl", amount_cents: -4230, kind: "expense" },
        { hash: "h2", date: "2026-01-02", description: "Salaire", amount_cents: 250000, kind: "income" },
        { hash: "h3", date: "2026-01-03", description: "Amazon", amount_cents: -3990, kind: "expense" },
      ],
    }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { imported: number };
    expect(body.imported).toBe(3);
  });
});

describe("POST /api/import/confirm — idempotence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reports the lines the database skipped because they were already imported", async () => {
    // 3 lines sent, the function only inserted 1 (the 2 others were already there)
    const { supabase } = buildSupabaseMock({ data: 1, error: null });
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [
        { hash: "h1", date: "2026-01-01", description: "Lidl", amount_cents: -4230, kind: "expense" },
        { hash: "h2", date: "2026-01-02", description: "Salaire", amount_cents: 250000, kind: "income" },
        { hash: "h3", date: "2026-01-03", description: "Amazon", amount_cents: -3990, kind: "expense" },
      ],
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, imported: 1, skipped: 2 });
  });

  it("reports nothing skipped on a fresh import", async () => {
    const { supabase } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{ hash: "h1", date: "2026-01-01", description: "Lidl", amount_cents: -4230, kind: "expense" }],
    }));

    expect(await res.json()).toMatchObject({ imported: 1, skipped: 0 });
  });
});

describe("POST /api/import/confirm — DB error", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when the rpc fails", async () => {
    const { supabase } = buildSupabaseMock({ error: { message: "violates foreign key constraint" } });
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({
      account_id: ACCOUNT_ID,
      transactions: [{
        hash: "hash-fail",
        date: "2026-01-15",
        description: "Test",
        amount_cents: -1000,
        kind: "expense",
      }],
    }));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("violates foreign key constraint");
  });
});

describe("POST /api/import/confirm — accounts must belong to the active space", () => {
  beforeEach(() => vi.clearAllMocks());

  const expense = { hash: "h1", date: "2026-01-15", description: "Netflix", amount_cents: -1599, kind: "expense" };

  it("returns 404 and inserts nothing when the target account is not in the space", async () => {
    const { supabase, rpc, accountsBuilder } = buildSupabaseMock({ data: 1, error: null }, []);
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({ account_id: ACCOUNT_ID, transactions: [expense] }));

    expect(res.status).toBe(404);
    expect(accountsBuilder.eq).toHaveBeenCalledWith("space_id", "space-test-id");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns 404 when a transfer counterpart account is not in the space", async () => {
    const { supabase, rpc } = buildSupabaseMock({ error: null }, [ACCOUNT_ID]);
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(
      makeRequest({
        account_id: ACCOUNT_ID,
        transactions: [{ ...expense, kind: "transfer", transfer_account_id: COUNTERPART_ACCOUNT_ID }],
      }),
    );

    expect(res.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("POST /api/import/confirm — atomic rpc", () => {
  beforeEach(() => vi.clearAllMocks());

  const expense = { hash: "h1", date: "2026-01-15", description: "Netflix", amount_cents: -1599, kind: "expense" };

  it("calls import_transactions once with rows and an empty p_shares", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({ account_id: ACCOUNT_ID, transactions: [expense] }));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[0]).toBe("import_transactions");
    expect(rpcArgs(rpc).p_shares).toEqual([]);
    expect(rpcArgs(rpc).p_rows[0]).not.toHaveProperty("id");
    expect(await res.json()).toEqual({ ok: true, imported: 1, skipped: 0, shared: 0 });
  });

  it("maps rpc errors: 23514 -> 400, 42501 -> 403, 23505 -> 409, other -> 400", async () => {
    for (const [code, status] of [["23514", 400], ["42501", 403], ["23505", 409], [undefined, 400]] as const) {
      const { supabase } = buildSupabaseMock({ error: { message: "boom", code } });
      vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));
      const res = await POST(makeRequest({ account_id: ACCOUNT_ID, transactions: [expense] }));
      expect(res.status).toBe(status);
      expect(((await res.json()) as { error: string }).error).toBe("boom");
    }
  });

  it("creates the shared expense of a shared line, linked by a generated transaction id", async () => {
    const { supabase, rpc, membersBuilder, spacesBuilder } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(
      makeRequest({
        account_id: ACCOUNT_ID,
        transactions: [
          { ...expense, share: { space_id: SHARED_ID, category_id: CATEGORY_ID, payer_share_percent: 70 } },
          { ...expense, hash: "h2", description: "Lidl" },
        ],
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, imported: 2, skipped: 0, shared: 1 });
    const { p_rows, p_shares } = rpcArgs(rpc);
    expect(p_rows).toHaveLength(2);
    expect(p_rows[0]?.id).toEqual(expect.any(String));
    expect(p_rows[1]).not.toHaveProperty("id");
    expect(p_shares).toEqual([
      {
        space_id: SHARED_ID,
        source_transaction_id: p_rows[0]?.id,
        category_id: CATEGORY_ID,
        shares: { "user-test-id": 70, "other-user": 30 },
      },
    ]);
    expect(membersBuilder.eq).toHaveBeenCalledWith("space_id", SHARED_ID);
    expect(spacesBuilder.eq).toHaveBeenCalledWith("id", SHARED_ID);
  });

  it("falls back to the space default percent and loads each target space once", async () => {
    const { supabase, rpc, membersBuilder } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    await POST(
      makeRequest({
        account_id: ACCOUNT_ID,
        transactions: [
          { ...expense, share: { space_id: SHARED_ID } },
          { ...expense, hash: "h2", share: { space_id: SHARED_ID, category_id: null } },
        ],
      }),
    );

    const { p_shares } = rpcArgs(rpc);
    expect(p_shares).toHaveLength(2);
    expect(p_shares[0]).toMatchObject({ category_id: null, shares: { "user-test-id": 50, "other-user": 50 } });
    expect(p_shares[0]?.source_transaction_id).not.toBe(p_shares[1]?.source_transaction_id);
    expect(membersBuilder.select).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when splitShares throws (caller not in the members list)", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    const otherMembers = createChainableMock({ data: [{ user_id: "someone-else" }], error: null });
    const from = supabase.from.getMockImplementation()!;
    supabase.from.mockImplementation((table: string) => (table === "space_members" ? otherMembers : from(table)));
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(
      makeRequest({ account_id: ACCOUNT_ID, transactions: [{ ...expense, share: { space_id: SHARED_ID } }] }),
    );
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a share on a transfer or an income (400)", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    for (const kind of ["transfer", "income"]) {
      const res = await POST(
        makeRequest({ account_id: ACCOUNT_ID, transactions: [{ ...expense, kind, share: { space_id: SHARED_ID } }] }),
      );
      expect(res.status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a share when the active space is shared (400)", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue({
      ...(asAuth(supabase) as object),
      space: { id: "space-test-id", name: "Colocation", kind: "shared", role: "member" },
    } as never);

    const res = await POST(
      makeRequest({ account_id: ACCOUNT_ID, transactions: [{ ...expense, share: { space_id: SHARED_ID } }] }),
    );
    expect(res.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a target space the caller is not a shared member of (403)", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(
      makeRequest({ account_id: ACCOUNT_ID, transactions: [{ ...expense, share: { space_id: OTHER_SHARED_ID } }] }),
    );
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses the personal space itself as a target (403)", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    const personalId = "00000000-0000-4000-8000-0000000000cc";
    vi.mocked(withSpace).mockResolvedValue({
      ...(asAuth(supabase) as object),
      spaceId: personalId,
      space: { id: personalId, name: "Personnel", kind: "personal", role: "owner" },
      spaces: [{ id: personalId, name: "Personnel", kind: "personal", role: "owner" }],
    } as never);

    const res = await POST(
      makeRequest({ account_id: ACCOUNT_ID, transactions: [{ ...expense, share: { space_id: personalId } }] }),
    );
    expect(res.status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts share: null as no share", async () => {
    const { supabase, rpc } = buildSupabaseMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));

    const res = await POST(makeRequest({ account_id: ACCOUNT_ID, transactions: [{ ...expense, share: null }] }));
    expect(res.status).toBe(200);
    expect(rpcArgs(rpc).p_shares).toEqual([]);
  });
});
