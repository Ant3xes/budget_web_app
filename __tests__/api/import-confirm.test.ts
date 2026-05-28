import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { POST } from "@/app/api/import/confirm/route";
import { createChainableMock } from "@/__tests__/mocks/supabase";

const mockUser = { id: "user-test-id", email: "test@budget.local" };
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const CATEGORY_ID = "00000000-0000-4000-8000-000000000002";
const COUNTERPART_ACCOUNT_ID = "00000000-0000-4000-8000-000000000003";

function buildSupabaseMock(insertResult: { error: null | { message: string } } = { error: null }) {
  const queryBuilder = createChainableMock(insertResult as { data: unknown; error: unknown });
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
      from: vi.fn(() => queryBuilder),
    },
    queryBuilder,
  };
}

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
    vi.mocked(createServerSupabaseClient).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from: vi.fn(),
    } as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>);

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
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );
  });

  it("returns 400 when account_id is missing", async () => {
    const res = await POST(makeRequest({ transactions: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when account_id is not a valid UUID", async () => {
    const res = await POST(makeRequest({ account_id: "not-a-uuid", transactions: [] }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/uuid/i);
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

  it("inserts 1 row for a valid expense and returns imported count", async () => {
    const { supabase, queryBuilder } = buildSupabaseMock();
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

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
    const inserted = (queryBuilder.insert.mock.calls[0]?.[0] as unknown[]);
    expect(inserted).toHaveLength(1);
    expect((inserted[0] as Record<string, unknown>).kind).toBe("expense");
    expect((inserted[0] as Record<string, unknown>).is_imported).toBe(true);
  });

  it("inserts 1 row for a valid income", async () => {
    const { supabase, queryBuilder } = buildSupabaseMock();
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

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
    const inserted = (queryBuilder.insert.mock.calls[0]?.[0] as unknown[]);
    expect(inserted).toHaveLength(1);
    expect((inserted[0] as Record<string, unknown>).kind).toBe("income");
    expect((inserted[0] as Record<string, unknown>).amount_cents).toBe(250000);
  });

  it("inserts 1 row for transfer WITHOUT counterpart account (no mirror)", async () => {
    const { supabase, queryBuilder } = buildSupabaseMock();
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

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
    const inserted = (queryBuilder.insert.mock.calls[0]?.[0] as unknown[]);
    expect(inserted).toHaveLength(1);                              // no mirror
    expect((inserted[0] as Record<string, unknown>).kind).toBe("transfer_debit");
    expect((inserted[0] as Record<string, unknown>).transfer_id).toBeNull();
  });

  it("inserts 2 rows for transfer WITH counterpart account (main + mirror)", async () => {
    const { supabase, queryBuilder } = buildSupabaseMock();
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

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

    const inserted = (queryBuilder.insert.mock.calls[0]?.[0] as unknown[]);
    expect(inserted).toHaveLength(2);

    const main = inserted[0] as Record<string, unknown>;
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
    const { supabase, queryBuilder } = buildSupabaseMock();
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

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

    const inserted = (queryBuilder.insert.mock.calls[0]?.[0] as unknown[]);
    expect((inserted[0] as Record<string, unknown>).category_id).toBeNull();
  });

  it("handles multiple transactions in one batch", async () => {
    const { supabase, queryBuilder } = buildSupabaseMock();
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

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

describe("POST /api/import/confirm — DB error", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when DB insert fails", async () => {
    const { supabase } = buildSupabaseMock({ error: { message: "violates foreign key constraint" } });
    vi.mocked(createServerSupabaseClient).mockResolvedValue(
      supabase as unknown as Awaited<ReturnType<typeof createServerSupabaseClient>>,
    );

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
