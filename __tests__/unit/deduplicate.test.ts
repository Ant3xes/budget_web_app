import { describe, expect, it, vi } from "vitest";

import {
  buildFileHashes,
  buildHash,
  findExistingHashes,
  findTransferMirrorMatches,
} from "@/lib/import/deduplicate";

describe("buildHash", () => {
  it("returns a 64-char hex SHA-256 string", () => {
    const hash = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1599 });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("produces deterministic output", () => {
    const input = { date: "2026-01-15", description: "Lidl", amount_cents: -4230 };
    expect(buildHash(input)).toBe(buildHash(input));
  });

  it("produces different hashes for different transactions", () => {
    const a = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1599 });
    const b = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1600 });
    const c = buildHash({ date: "2026-01-02", description: "Netflix", amount_cents: -1599 });
    const d = buildHash({ date: "2026-01-01", description: "Amazon", amount_cents: -1599 });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(a).not.toBe(d);
  });

  it("is sensitive to all three fields", () => {
    const base = { date: "2026-01-01", description: "Test", amount_cents: 100 };
    const changedDate = buildHash({ ...base, date: "2026-01-02" });
    const changedDesc = buildHash({ ...base, description: "Test2" });
    const changedAmt = buildHash({ ...base, amount_cents: 101 });
    const original = buildHash(base);
    expect(changedDate).not.toBe(original);
    expect(changedDesc).not.toBe(original);
    expect(changedAmt).not.toBe(original);
  });
});

// ---------------------------------------------------------------------------
// buildFileHashes
// ---------------------------------------------------------------------------

describe("buildFileHashes", () => {
  const coffee = { date: "2026-01-05", description: "Boulangerie", amount_cents: -300 };

  it("keeps the historical hash for the first occurrence of a line", () => {
    expect(buildFileHashes([coffee])[0]).toBe(buildHash(coffee));
  });

  it("gives identical lines of a file distinct, stable hashes", () => {
    const hashes = buildFileHashes([coffee, coffee, coffee]);
    expect(new Set(hashes).size).toBe(3);
    expect(hashes[1]).toBe(buildHash(coffee, 1));
    expect(buildFileHashes([coffee, coffee, coffee])).toEqual(hashes);
  });

  it("re-exports overlapping the first one line up: the 1st line stays the 1st", () => {
    const other = { date: "2026-01-06", description: "Lidl", amount_cents: -1000 };
    const first = buildFileHashes([coffee]);
    const overlapping = buildFileHashes([coffee, coffee, other]);
    expect(overlapping[0]).toBe(first[0]);
    expect(overlapping[1]).not.toBe(first[0]);
  });
});

// ---------------------------------------------------------------------------
// In-memory Supabase: filters, order and range() on a single "transactions" table
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function makeSupabase(rows: Row[], { maxRows = 1000 }: { maxRows?: number } = {}) {
  const calls: { filters: Record<string, unknown>; range?: [number, number] }[] = [];
  const from = vi.fn(() => {
    const filters: Array<(r: Row) => boolean> = [];
    const recorded: Record<string, unknown> = {};
    let window: [number, number] | undefined;
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, val: unknown) => {
        recorded[col] = val;
        filters.push((r) => r[col] === val);
        return chain;
      },
      is: (col: string, val: unknown) => {
        filters.push((r) => (val === null ? r[col] == null : r[col] === val));
        return chain;
      },
      not: (col: string, _op: string, val: unknown) => {
        filters.push((r) => (val === null ? r[col] != null : r[col] !== val));
        return chain;
      },
      gte: (col: string, val: string) => {
        filters.push((r) => String(r[col]) >= val);
        return chain;
      },
      lt: (col: string, val: string) => {
        filters.push((r) => String(r[col]) < val);
        return chain;
      },
      order: () => chain,
      range: (a: number, b: number) => {
        window = [a, b];
        calls.push({ filters: recorded, range: [a, b] });
        return chain;
      },
    };
    Object.defineProperty(chain, "then", {
      get() {
        const matching = rows.filter((r) => filters.every((f) => f(r)));
        const [a, b] = window ?? [0, maxRows - 1];
        const page = matching.slice(a, Math.min(b, a + maxRows - 1) + 1);
        const p = Promise.resolve({ data: page, error: null });
        return p.then.bind(p);
      },
    });
    return chain;
  });
  return { supabase: { from } as unknown as Parameters<typeof findExistingHashes>[0], calls };
}

const imported = (hash: string, account = "acc-1", extra: Row = {}): Row => ({
  space_id: "space-1",
  account_id: account,
  is_imported: true,
  deleted_at: null,
  raw_import_data: { hash },
  ...extra,
});

// ---------------------------------------------------------------------------
// findExistingHashes
// ---------------------------------------------------------------------------

describe("findExistingHashes", () => {
  it("returns empty set for empty hashes input", async () => {
    const { supabase } = makeSupabase([]);
    expect((await findExistingHashes(supabase, "space-1", [])).size).toBe(0);
  });

  it("detects hash from previously imported transaction (raw_import_data)", async () => {
    const hash = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1599 });
    const { supabase } = makeSupabase([imported(hash)]);
    expect((await findExistingHashes(supabase, "space-1", [hash])).has(hash)).toBe(true);
  });

  it("detects a manual transaction by computing date|description|amount_cents", async () => {
    const tx = { date: "2026-01-10", description: "Virement interne", amount_cents: -50000 };
    const { supabase } = makeSupabase([
      { space_id: "space-1", account_id: "acc-1", is_imported: false, deleted_at: null, ...tx },
    ]);
    expect((await findExistingHashes(supabase, "space-1", [buildHash(tx)])).has(buildHash(tx))).toBe(true);
  });

  it("reads the date of a timestamptz column back as a plain day", async () => {
    // Postgres returns "2026-01-10T00:00:00+00:00" for a timestamptz
    const tx = { date: "2026-01-10", description: "Loyer", amount_cents: -70000 };
    const { supabase } = makeSupabase([
      { space_id: "space-1", account_id: "acc-1", is_imported: false, deleted_at: null, ...tx, date: "2026-01-10T00:00:00+00:00" },
    ]);
    expect((await findExistingHashes(supabase, "space-1", [buildHash(tx)])).size).toBe(1);
  });

  it("does not include hashes that are not in the input list", async () => {
    const otherHash = buildHash({ date: "2025-06-01", description: "Random", amount_cents: -100 });
    const inputHash = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1599 });
    const { supabase } = makeSupabase([imported(otherHash)]);
    const result = await findExistingHashes(supabase, "space-1", [inputHash]);
    expect(result.size).toBe(0);
  });

  it("handles null raw_import_data entries gracefully", async () => {
    const hash = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1599 });
    const { supabase } = makeSupabase([imported(hash, "acc-1", { id: 1 }), { ...imported("x"), raw_import_data: null }]);
    expect((await findExistingHashes(supabase, "space-1", [hash])).has(hash)).toBe(true);
  });

  it("ignores other spaces", async () => {
    const hash = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1599 });
    const { supabase } = makeSupabase([imported(hash, "acc-1", { space_id: "space-2" })]);
    expect((await findExistingHashes(supabase, "space-1", [hash])).size).toBe(0);
  });

  it("restricts the lookup to the target account when given", async () => {
    const hash = buildHash({ date: "2026-01-05", description: "RETRAIT DAB", amount_cents: -5000 });
    const { supabase } = makeSupabase([imported(hash, "acc-bnp")]);

    expect((await findExistingHashes(supabase, "space-1", [hash], "acc-n26")).size).toBe(0);
    expect((await findExistingHashes(supabase, "space-1", [hash], "acc-bnp")).size).toBe(1);
    expect((await findExistingHashes(supabase, "space-1", [hash])).size).toBe(1); // no account: whole space
  });

  it("stays reliable past the 1000-row cap of a single response", async () => {
    const all = Array.from({ length: 2300 }, (_, i) =>
      buildHash({ date: "2026-01-01", description: `Ligne ${i}`, amount_cents: -i }),
    );
    const { supabase, calls } = makeSupabase(all.map((h, i) => imported(h, "acc-1", { id: i })));

    const result = await findExistingHashes(supabase, "space-1", all);

    expect(result.size).toBe(2300);
    expect(calls.filter((c) => c.filters.is_imported === true)).toHaveLength(3); // 1000 + 1000 + 300
  });
});

// ---------------------------------------------------------------------------
// findTransferMirrorMatches
// ---------------------------------------------------------------------------

describe("findTransferMirrorMatches", () => {
  const mirror = (id: string, date: string, amount: number, extra: Row = {}): Row => ({
    id,
    space_id: "space-1",
    account_id: "acc-n26",
    is_imported: false,
    transfer_id: "tr-1",
    deleted_at: null,
    date,
    amount_cents: amount,
    ...extra,
  });

  it("matches the file line that is the other side of an existing mirror", async () => {
    const { supabase } = makeSupabase([mirror("m1", "2026-01-05", 50000)]);
    const matched = await findTransferMirrorMatches(supabase, "space-1", "acc-n26", [
      { date: "2026-01-05", amount_cents: -1200 },
      { date: "2026-01-05", amount_cents: 50000 },
    ]);
    expect([...matched]).toEqual([1]);
  });

  it("tolerates a few days between the two banks", async () => {
    const { supabase } = makeSupabase([mirror("m1", "2026-01-05", 50000)]);
    const near = await findTransferMirrorMatches(supabase, "space-1", "acc-n26", [{ date: "2026-01-08", amount_cents: 50000 }]);
    const far = await findTransferMirrorMatches(supabase, "space-1", "acc-n26", [{ date: "2026-01-09", amount_cents: 50000 }]);
    expect(near.size).toBe(1);
    expect(far.size).toBe(0);
  });

  it("does not match a different amount, sign, account or a plain transaction", async () => {
    const { supabase } = makeSupabase([
      mirror("m1", "2026-01-05", 50000),
      mirror("m2", "2026-01-05", 30000, { account_id: "acc-other" }),
      mirror("m3", "2026-01-05", 20000, { transfer_id: null }),
      mirror("m4", "2026-01-05", 10000, { is_imported: true }),
    ]);
    const matched = await findTransferMirrorMatches(supabase, "space-1", "acc-n26", [
      { date: "2026-01-05", amount_cents: -50000 },
      { date: "2026-01-05", amount_cents: 50100 },
      { date: "2026-01-05", amount_cents: 30000 },
      { date: "2026-01-05", amount_cents: 20000 },
      { date: "2026-01-05", amount_cents: 10000 },
    ]);
    expect(matched.size).toBe(0);
  });

  it("a mirror absorbs a single line — the closest one", async () => {
    const { supabase } = makeSupabase([mirror("m1", "2026-01-05", 50000)]);
    const matched = await findTransferMirrorMatches(supabase, "space-1", "acc-n26", [
      { date: "2026-01-07", amount_cents: 50000 },
      { date: "2026-01-05", amount_cents: 50000 },
    ]);
    expect([...matched]).toEqual([1]);
  });

  it("two mirrors absorb two lines of the same amount", async () => {
    const { supabase } = makeSupabase([mirror("m1", "2026-01-05", 50000), mirror("m2", "2026-01-06", 50000)]);
    const matched = await findTransferMirrorMatches(supabase, "space-1", "acc-n26", [
      { date: "2026-01-05", amount_cents: 50000 },
      { date: "2026-01-06", amount_cents: 50000 },
      { date: "2026-01-07", amount_cents: 50000 },
    ]);
    expect(matched.size).toBe(2);
  });

  it("ignores deleted mirrors and returns early without lines", async () => {
    const { supabase } = makeSupabase([mirror("m1", "2026-01-05", 50000, { deleted_at: "2026-02-01" })]);
    const matched = await findTransferMirrorMatches(supabase, "space-1", "acc-n26", [{ date: "2026-01-05", amount_cents: 50000 }]);
    expect(matched.size).toBe(0);
    expect((await findTransferMirrorMatches(supabase, "space-1", "acc-n26", [])).size).toBe(0);
  });
});
