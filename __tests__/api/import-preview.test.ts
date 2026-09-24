import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));

// Mock all import library modules to isolate the route logic
vi.mock("@/lib/import/apply-rules", () => ({
  buildRuleMatcher: vi.fn().mockResolvedValue(() => null),
  buildRuleShareMatcher: vi.fn().mockResolvedValue(() => null),
  buildHistoryMatcher: vi.fn().mockResolvedValue(() => null),
  buildDefaultMatcher: vi.fn().mockReturnValue(() => null),
  detectTransfer: vi.fn().mockReturnValue(false),
}));
vi.mock("@/lib/import/deduplicate", () => ({
  buildHash: vi.fn((tx: { date: string; description: string; amount_cents: number }) =>
    `hash_${tx.date}_${tx.description}_${tx.amount_cents}`,
  ),
  findExistingHashes: vi.fn().mockResolvedValue(new Set<string>()),
}));

import { withSpace } from "@/lib/spaces/with-space";
import { buildRuleMatcher, buildRuleShareMatcher, detectTransfer } from "@/lib/import/apply-rules";
import { findExistingHashes } from "@/lib/import/deduplicate";
import { POST } from "@/app/api/import/preview/route";
import { createChainableMock } from "@/__tests__/mocks/supabase";

const mockUser = { id: "user-test-id", email: "test@budget.local" };

const asAuth = (supabase: unknown) =>
  ({
    supabase,
    user: mockUser,
    spaceId: "space-test-id",
    space: { id: "space-test-id", name: "Personnel", kind: "personal", role: "owner" },
    spaces: [],
  }) as never;

// N26 CSV sample
const N26_CSV = [
  `"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"`,
  `"2026-01-15","2026-01-15","Netflix","","Presentment","","Compte courant","-15.99","",""`,
  `"2026-01-10","2026-01-10","Employeur SA","","Credit Transfer","Salaire janvier","Compte courant","2500.00","",""`,
  `"2026-01-05","2026-01-05","Lidl","","Presentment","","Compte courant","-42.30","",""`,
].join("\n");

function makeN26File(content = N26_CSV) {
  return new File([content], "export.csv", { type: "text/csv" });
}

function makeFormData(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  return fd;
}

function makeRequest(formData: FormData) {
  return new Request("http://localhost/api/import/preview", {
    method: "POST",
    body: formData,
  });
}

function buildAuthMock(user: typeof mockUser | null = mockUser) {
  const queryBuilder = createChainableMock({ data: [], error: null });
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
      },
      from: vi.fn(() => queryBuilder),
    },
    queryBuilder,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(buildRuleMatcher).mockResolvedValue(() => null);
  vi.mocked(buildRuleShareMatcher).mockResolvedValue(() => null);
  vi.mocked(findExistingHashes).mockResolvedValue(new Set<string>());
  vi.mocked(detectTransfer).mockReturnValue(false);
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

describe("POST /api/import/preview — auth", () => {
  it("returns 401 when not authenticated", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);

    const res = await POST(makeRequest(makeFormData(makeN26File())));
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized");
  });
});

// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------

describe("POST /api/import/preview — file validation", () => {
  beforeEach(() => {
    const { supabase } = buildAuthMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));
  });

  it("returns 400 when no file is provided", async () => {
    const fd = new FormData();
    const res = await POST(makeRequest(fd));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/fichier manquant/i);
  });

  it("returns 400 for unsupported file extension (.pdf)", async () => {
    const file = new File(["dummy"], "statement.pdf", { type: "application/pdf" });
    const res = await POST(makeRequest(makeFormData(file)));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/non support/i);
  });

  it("returns 400 for unrecognized CSV format (not N26)", async () => {
    const unknownCsv = `"Date","Montant","Libellé"\n"2026-01-01","-10.00","Test"`;
    const file = new File([unknownCsv], "export.csv", { type: "text/csv" });
    const res = await POST(makeRequest(makeFormData(file)));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/format csv non reconnu/i);
  });

  it("returns 400 when N26 CSV has no transactions (headers only)", async () => {
    const emptyN26 = `"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"`;
    const file = new File([emptyN26], "export.csv", { type: "text/csv" });
    const res = await POST(makeRequest(makeFormData(file)));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/aucune transaction/i);
  });
});

// ---------------------------------------------------------------------------
// Preview content
// ---------------------------------------------------------------------------

describe("POST /api/import/preview — preview content", () => {
  beforeEach(() => {
    const { supabase } = buildAuthMock();
    vi.mocked(withSpace).mockResolvedValue(asAuth(supabase));
  });

  it("returns 200 with correct preview shape for N26 CSV", async () => {
    const res = await POST(makeRequest(makeFormData(makeN26File())));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { preview: unknown[] };
    expect(body.preview).toHaveLength(3);

    const first = body.preview[0] as Record<string, unknown>;
    expect(first).toMatchObject({
      hash: expect.any(String),
      date: "2026-01-15",
      description: "Netflix",
      amount_cents: -1599,
      kind: "expense",
      is_duplicate: false,
      is_transfer_candidate: false,
    });
  });

  it("scopes dedup and matchers by the active space", async () => {
    await POST(makeRequest(makeFormData(makeN26File())));
    expect(vi.mocked(findExistingHashes).mock.calls[0]?.[1]).toBe("space-test-id");
    expect(vi.mocked(buildRuleMatcher).mock.calls[0]?.[1]).toBe("space-test-id");
  });

  it("classifies positive amounts as income", async () => {
    const res = await POST(makeRequest(makeFormData(makeN26File())));
    const body = (await res.json()) as { preview: Record<string, unknown>[] };

    const salary = body.preview.find((r) => r.description === "Employeur SA");
    expect(salary?.kind).toBe("income");
    expect(Number(salary?.amount_cents)).toBeGreaterThan(0);
  });

  it("marks rows as is_duplicate when hash already in DB", async () => {
    // Override findExistingHashes to return all hashes as existing
    vi.mocked(findExistingHashes).mockImplementation(async (_sb, _sid, hashes) =>
      new Set(hashes),
    );

    const res = await POST(makeRequest(makeFormData(makeN26File())));
    const body = (await res.json()) as { preview: Record<string, unknown>[] };

    expect(body.preview.every((r) => r.is_duplicate === true)).toBe(true);
  });

  it("marks only the first occurrence of intra-file duplicate as non-duplicate", async () => {
    // Create a CSV with two identical rows
    const duplicateCsv = [
      `"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"`,
      `"2026-01-15","2026-01-15","Netflix","","Presentment","","Compte courant","-15.99","",""`,
      `"2026-01-15","2026-01-15","Netflix","","Presentment","","Compte courant","-15.99","",""`,
    ].join("\n");

    const res = await POST(makeRequest(makeFormData(new File([duplicateCsv], "export.csv"))));
    const body = (await res.json()) as { preview: Record<string, unknown>[] };

    expect(body.preview).toHaveLength(2);
    expect(body.preview[0]?.is_duplicate).toBe(false);   // first occurrence
    expect(body.preview[1]?.is_duplicate).toBe(true);    // second occurrence
  });

  it("sets is_transfer_candidate from detectTransfer mock", async () => {
    vi.mocked(detectTransfer).mockImplementation(
      (desc: string) => desc.toLowerCase().includes("virement"),
    );

    const csvWithTransfer = [
      `"Booking Date","Value Date","Partner Name","Partner Iban","Type","Payment Reference","Account Name","Amount (EUR)","Original Amount","Original Currency","Exchange Rate"`,
      `"2026-01-20","2026-01-20","Virement SEPA","","Credit Transfer","","Compte courant","-500.00","",""`,
      `"2026-01-15","2026-01-15","Netflix","","Presentment","","Compte courant","-15.99","",""`,
    ].join("\n");

    const res = await POST(makeRequest(makeFormData(new File([csvWithTransfer], "export.csv"))));
    const body = (await res.json()) as { preview: Record<string, unknown>[] };

    const transfer = body.preview.find((r) => r.description === "Virement SEPA");
    const regular = body.preview.find((r) => r.description === "Netflix");

    expect(transfer?.is_transfer_candidate).toBe(true);
    expect(regular?.is_transfer_candidate).toBe(false);
  });

  it("does NOT set suggested_category_id for transfer candidates", async () => {
    vi.mocked(detectTransfer).mockReturnValue(true);           // all are transfers
    vi.mocked(buildRuleMatcher).mockResolvedValue(() => "cat-id-from-rule");

    const res = await POST(makeRequest(makeFormData(makeN26File())));
    const body = (await res.json()) as { preview: Record<string, unknown>[] };

    expect(body.preview.every((r) => r.suggested_category_id === null)).toBe(true);
  });

  it("does NOT set suggested_category_id for duplicates", async () => {
    vi.mocked(findExistingHashes).mockImplementation(async (_sb, _sid, hashes) =>
      new Set(hashes),
    );
    vi.mocked(buildRuleMatcher).mockResolvedValue(() => "cat-id-from-rule");

    const res = await POST(makeRequest(makeFormData(makeN26File())));
    const body = (await res.json()) as { preview: Record<string, unknown>[] };

    expect(body.preview.every((r) => r.suggested_category_id === null)).toBe(true);
  });

  it("sets suggested_category_id when rule matcher returns a match", async () => {
    vi.mocked(buildRuleMatcher).mockResolvedValue(
      (desc: string) => desc === "Netflix" ? "cat-streaming" : null,
    );

    const res = await POST(makeRequest(makeFormData(makeN26File())));
    const body = (await res.json()) as { preview: Record<string, unknown>[] };

    const netflix = body.preview.find((r) => r.description === "Netflix");
    expect(netflix?.suggested_category_id).toBe("cat-streaming");
  });
});

// ---------------------------------------------------------------------------
// suggested_share
// ---------------------------------------------------------------------------

describe("POST /api/import/preview — suggested_share", () => {
  const SHARED_ID = "space-shared-id";
  const sharedSpaces = [
    { id: "space-test-id", name: "Personnel", kind: "personal", role: "owner" },
    { id: SHARED_ID, name: "Colocation", kind: "shared", role: "member" },
  ];

  function setup(opts: { kind?: "personal" | "shared"; spaces?: unknown[]; spacesRows?: unknown[] } = {}) {
    const spacesBuilder = createChainableMock({
      data: opts.spacesRows ?? [{ id: SHARED_ID, name: "Colocation", default_share_percent: 50 }],
      error: null,
    });
    const otherBuilder = createChainableMock({ data: [], error: null });
    const supabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }) },
      from: vi.fn((table: string) => (table === "spaces" ? spacesBuilder : otherBuilder)),
    };
    const kind = opts.kind ?? "personal";
    vi.mocked(withSpace).mockResolvedValue({
      supabase,
      user: mockUser,
      spaceId: "space-test-id",
      space: { id: "space-test-id", name: "Espace", kind, role: "owner" },
      spaces: opts.spaces ?? sharedSpaces,
    } as never);
    return { supabase, spacesBuilder };
  }

  const shareNetflix = (percent: number | null = null) =>
    vi.mocked(buildRuleShareMatcher).mockResolvedValue((desc: string, kind: string) =>
      desc === "Netflix" && kind === "expense"
        ? { space_id: SHARED_ID, category_id: "cat-common", payer_share_percent: percent }
        : null,
    );

  type Row = Record<string, unknown>;
  const run = async () => ((await (await POST(makeRequest(makeFormData(makeN26File())))).json()) as { preview: Row[] }).preview;

  it("suggests the share of the matching rule, with the space default percent", async () => {
    const { spacesBuilder } = setup({ spacesRows: [{ id: SHARED_ID, name: "Colocation", default_share_percent: 60 }] });
    shareNetflix();
    const preview = await run();
    expect(preview.find((r) => r.description === "Netflix")?.suggested_share).toEqual({
      space_id: SHARED_ID,
      space_name: "Colocation",
      category_id: "cat-common",
      payer_share_percent: 60,
    });
    expect(preview.find((r) => r.description === "Lidl")?.suggested_share).toBeNull();
    expect(spacesBuilder.in).toHaveBeenCalledWith("id", [SHARED_ID]);
  });

  it("uses the rule payer percent over the space default", async () => {
    setup();
    shareNetflix(30);
    const preview = await run();
    expect((preview.find((r) => r.description === "Netflix")?.suggested_share as Row).payer_share_percent).toBe(30);
  });

  it("does not query spaces when no rule shares", async () => {
    const { supabase } = setup();
    await run();
    expect(supabase.from).not.toHaveBeenCalledWith("spaces");
  });

  it("gives null for every row in a shared active space, without building the matcher", async () => {
    setup({ kind: "shared" });
    shareNetflix();
    const preview = await run();
    expect(preview.every((r) => r.suggested_share === null)).toBe(true);
    expect(buildRuleShareMatcher).not.toHaveBeenCalled();
  });

  it("gives null for a stale rule (space the caller left), without error", async () => {
    const { supabase } = setup({ spaces: [sharedSpaces[0]] });
    shareNetflix();
    const preview = await run();
    expect(preview.every((r) => r.suggested_share === null)).toBe(true);
    expect(supabase.from).not.toHaveBeenCalledWith("spaces");
  });

  it("gives null for income rows", async () => {
    setup();
    vi.mocked(buildRuleShareMatcher).mockResolvedValue(() => ({
      space_id: SHARED_ID,
      category_id: null,
      payer_share_percent: null,
    }));
    const preview = await run();
    expect(preview.find((r) => r.description === "Employeur SA")?.suggested_share).toBeNull();
    expect(preview.find((r) => r.description === "Lidl")?.suggested_share).not.toBeNull();
  });

  it("gives null for duplicates", async () => {
    setup();
    shareNetflix();
    vi.mocked(findExistingHashes).mockImplementation(async (_sb, _sid, hashes) => new Set(hashes));
    const preview = await run();
    expect(preview.every((r) => r.suggested_share === null)).toBe(true);
  });

  it("gives null for transfer candidates", async () => {
    setup();
    shareNetflix();
    vi.mocked(detectTransfer).mockReturnValue(true);
    const preview = await run();
    expect(preview.every((r) => r.suggested_share === null)).toBe(true);
  });
});
