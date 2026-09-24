import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ getAll: () => [], set: vi.fn() })),
}));
vi.mock("@/lib/spaces/with-space", () => ({ withSpace: vi.fn() }));
vi.mock("@/lib/import/rule-retro-candidates", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/import/rule-retro-candidates")>()),
  fetchRetroCandidates: vi.fn(),
}));

import { GET, POST } from "@/app/api/import-rules/[id]/apply-share/route";
import { fetchRetroCandidates } from "@/lib/import/rule-retro-candidates";
import { withSpace } from "@/lib/spaces/with-space";
import { createChainableMock } from "@/__tests__/mocks/supabase";

const USER = { id: "a0000000-0000-0000-0000-000000000001", email: "alice@budget.local" };
const BOB = "a0000000-0000-0000-0000-000000000002";
const RULE_ID = "00000000-0000-4000-8000-0000000000ee";
const SHARED_ID = "c0000000-0000-0000-0000-000000000001";
const SHARE_CATEGORY_ID = "00000000-0000-4000-8000-0000000000dd";
const TX_1 = "00000000-0000-4000-8000-000000000101";
const TX_2 = "00000000-0000-4000-8000-000000000102";
const TX_FOREIGN = "00000000-0000-4000-8000-000000000199";

const personal = { id: "space-personal", name: "Personnel", kind: "personal", role: "owner" };
const shared = { id: SHARED_ID, name: "Foyer", kind: "shared", role: "owner" };

const candidate = (id: string, amount = -80000) => ({ id, date: "2026-06-01T00:00:00Z", description: "Loyer", amount_cents: amount });

type Result = { data: unknown; error: unknown };

function setup(
  tables: Record<string, Result>,
  opts: { active?: typeof personal | typeof shared; spaces?: unknown[]; rpcError?: { code?: string; message: string } | null } = {},
) {
  const builders: Record<string, ReturnType<typeof createChainableMock>> = {};
  const from = vi.fn((table: string) => (builders[table] ??= createChainableMock(tables[table] ?? { data: null, error: null })));
  const rpc = vi.fn(() => Promise.resolve({ data: null, error: opts.rpcError ?? null }));
  const active = opts.active ?? personal;
  vi.mocked(withSpace).mockResolvedValue({
    supabase: { from, rpc },
    user: USER,
    spaceId: active.id,
    space: active,
    spaces: opts.spaces ?? [personal, shared],
  } as never);
  return { from, rpc, builders };
}

const rule = (over: Record<string, unknown> = {}) => ({
  data: { id: RULE_ID, share_space_id: SHARED_ID, share_category_id: SHARE_CATEGORY_ID, share_payer_percent: null, ...over },
  error: null,
});

const params = { params: Promise.resolve({ id: RULE_ID }) };
const get = (query = "") => GET(new Request(`http://localhost/api/import-rules/${RULE_ID}/apply-share${query}`), params);
const post = (body: unknown) =>
  POST(
    new Request(`http://localhost/api/import-rules/${RULE_ID}/apply-share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    params,
  );

beforeEach(() => vi.clearAllMocks());

describe("GET apply-share (preview)", () => {
  const tables = () => ({
    csv_import_rules: rule(),
    space_members: { data: { joined_at: "2026-05-01T00:00:00Z" }, error: null },
    spaces: { data: { default_share_percent: 60 }, error: null },
  });

  it("401 when unauthenticated", async () => {
    vi.mocked(withSpace).mockResolvedValue(null);
    expect((await get()).status).toBe(401);
  });

  it("400 from a shared space", async () => {
    setup(tables(), { active: shared });
    expect((await get()).status).toBe(400);
  });

  it("404 for an unknown rule", async () => {
    setup({ ...tables(), csv_import_rules: { data: null, error: null } });
    expect((await get()).status).toBe(404);
  });

  it("400 for a rule that does not share", async () => {
    setup({ ...tables(), csv_import_rules: rule({ share_space_id: null }) });
    expect((await get()).status).toBe(400);
  });

  it("403 when the target is not one of the user's shared spaces", async () => {
    setup(tables(), { spaces: [personal] });
    expect((await get()).status).toBe(403);
  });

  it("400 for an invalid since", async () => {
    setup(tables());
    expect((await get("?since=nope")).status).toBe(400);
  });

  it("defaults since to the join date and returns candidates without writing", async () => {
    const { rpc } = setup(tables());
    vi.mocked(fetchRetroCandidates).mockResolvedValue([candidate(TX_1), candidate(TX_2, -12000)]);

    const res = await get();
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      since: "2026-05-01",
      since_default: "2026-05-01",
      target_space: { id: SHARED_ID, name: "Foyer" },
      payer_percent: 60,
      total_cents: 92000,
      truncated: false,
    });
    expect(fetchRetroCandidates).toHaveBeenCalledWith(expect.anything(), personal.id, RULE_ID, "2026-05-01");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the rule's own percent and the requested since", async () => {
    setup({ ...tables(), csv_import_rules: rule({ share_payer_percent: 30 }) });
    vi.mocked(fetchRetroCandidates).mockResolvedValue([]);

    const body = (await (await get("?since=2026-08-01")).json()) as { since: string; payer_percent: number };
    expect(body.since).toBe("2026-08-01");
    expect(body.payer_percent).toBe(30);
    expect(fetchRetroCandidates).toHaveBeenCalledWith(expect.anything(), personal.id, RULE_ID, "2026-08-01");
  });

  it("caps the preview at 500 rows and flags truncation", async () => {
    setup(tables());
    vi.mocked(fetchRetroCandidates).mockResolvedValue(
      Array.from({ length: 501 }, (_, i) => candidate(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`)),
    );
    const body = (await (await get()).json()) as { rows: unknown[]; truncated: boolean };
    expect(body.rows).toHaveLength(500);
    expect(body.truncated).toBe(true);
  });
});

describe("POST apply-share (apply)", () => {
  const tables = () => ({
    csv_import_rules: rule(),
    space_members: { data: [{ user_id: USER.id }, { user_id: BOB }], error: null },
    spaces: { data: { default_share_percent: 50 }, error: null },
  });
  const body = (ids: string[]) => ({ since: "2026-05-01", transaction_ids: ids });

  it("400 on an invalid body", async () => {
    setup(tables());
    expect((await post({ since: "2026-05-01", transaction_ids: [] })).status).toBe(400);
    expect((await post({ since: "nope", transaction_ids: [TX_1] })).status).toBe(400);
  });

  it("403 when the target is not one of the user's shared spaces", async () => {
    setup(tables(), { spaces: [personal] });
    expect((await post(body([TX_1]))).status).toBe(403);
  });

  it("recomputes candidates server-side: unknown ids are ignored", async () => {
    const { rpc } = setup(tables());
    vi.mocked(fetchRetroCandidates).mockResolvedValue([candidate(TX_1)]);

    const res = await post(body([TX_1, TX_FOREIGN]));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, shared: 1 });

    const payload = (rpc.mock.calls[0] as unknown as [string, { p_shares: { source_transaction_id: string }[] }])[1].p_shares;
    expect(payload.map((s) => s.source_transaction_id)).toEqual([TX_1]);
  });

  it("shares nothing (no rpc) when no id is a candidate anymore", async () => {
    const { rpc } = setup(tables());
    vi.mocked(fetchRetroCandidates).mockResolvedValue([]);

    expect(await (await post(body([TX_1]))).json()).toEqual({ ok: true, shared: 0 });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the atomic rpc with the frozen split and the rule's common category", async () => {
    const { rpc } = setup({ ...tables(), csv_import_rules: rule({ share_payer_percent: 70 }) });
    vi.mocked(fetchRetroCandidates).mockResolvedValue([candidate(TX_1), candidate(TX_2)]);

    const res = await post(body([TX_1, TX_2]));
    expect(await res.json()).toEqual({ ok: true, shared: 2 });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [name, args] = rpc.mock.calls[0] as unknown as [string, { p_shares: unknown[] }];
    expect(name).toBe("share_transactions");
    expect(args.p_shares).toEqual([
      { space_id: SHARED_ID, source_transaction_id: TX_1, category_id: SHARE_CATEGORY_ID, shares: { [USER.id]: 70, [BOB]: 30 } },
      { space_id: SHARED_ID, source_transaction_id: TX_2, category_id: SHARE_CATEGORY_ID, shares: { [USER.id]: 70, [BOB]: 30 } },
    ]);
  });

  it("falls back to the space's default split", async () => {
    const { rpc } = setup({ ...tables(), spaces: { data: { default_share_percent: 60 }, error: null } });
    vi.mocked(fetchRetroCandidates).mockResolvedValue([candidate(TX_1)]);

    await post(body([TX_1]));
    const args = (rpc.mock.calls[0] as unknown as [string, { p_shares: { shares: unknown }[] }])[1];
    expect(args.p_shares[0]?.shares).toEqual({ [USER.id]: 60, [BOB]: 40 });
  });

  it("maps a database error (whole batch rejected) to an HTTP error", async () => {
    setup(tables(), { rpcError: { code: "23505", message: "duplicate key" } });
    vi.mocked(fetchRetroCandidates).mockResolvedValue([candidate(TX_1)]);

    expect((await post(body([TX_1]))).status).toBe(409);
  });
});
