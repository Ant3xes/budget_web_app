import { describe, expect, it, vi } from "vitest";

import { buildHash, findExistingHashes } from "@/lib/import/deduplicate";

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
// findExistingHashes
// ---------------------------------------------------------------------------

describe("findExistingHashes", () => {
  function makeChain(result: unknown) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    chain.select = vi.fn(self);
    chain.eq = vi.fn(self);
    chain.is = vi.fn(self);
    chain.not = vi.fn(self);
    Object.defineProperty(chain, "then", {
      get() {
        return Promise.resolve(result).then.bind(Promise.resolve(result));
      },
    });
    return chain;
  }

  function makeSupabase(importedData: unknown[], manualData: unknown[]) {
    const importedChain = makeChain({ data: importedData, error: null });
    const manualChain = makeChain({ data: manualData, error: null });
    return {
      from: vi.fn().mockReturnValueOnce(importedChain).mockReturnValueOnce(manualChain),
    } as unknown as Parameters<typeof findExistingHashes>[0];
  }

  it("returns empty set for empty hashes input", async () => {
    const supabase = makeSupabase([], []);
    const result = await findExistingHashes(supabase, "user-1", []);
    expect(result.size).toBe(0);
  });

  it("detects hash from previously imported transaction (raw_import_data)", async () => {
    const hash = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1599 });
    const supabase = makeSupabase(
      [{ raw_import_data: { hash } }],
      [],
    );
    const result = await findExistingHashes(supabase, "user-1", [hash]);
    expect(result.has(hash)).toBe(true);
  });

  it("detects hash from manual transaction by computing date|description|amount_cents", async () => {
    const tx = { date: "2026-01-10", description: "Virement interne", amount_cents: -50000 };
    const hash = buildHash(tx);
    const supabase = makeSupabase(
      [],
      [{ date: tx.date, description: tx.description, amount_cents: tx.amount_cents }],
    );
    const result = await findExistingHashes(supabase, "user-1", [hash]);
    expect(result.has(hash)).toBe(true);
  });

  it("does not include hashes that are not in the input list", async () => {
    const otherHash = buildHash({ date: "2025-06-01", description: "Random", amount_cents: -100 });
    const supabase = makeSupabase(
      [{ raw_import_data: { hash: otherHash } }],
      [],
    );
    const inputHash = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1599 });
    const result = await findExistingHashes(supabase, "user-1", [inputHash]);
    expect(result.has(otherHash)).toBe(false);
    expect(result.size).toBe(0);
  });

  it("handles null raw_import_data entries gracefully", async () => {
    const hash = buildHash({ date: "2026-01-01", description: "Netflix", amount_cents: -1599 });
    const supabase = makeSupabase(
      [{ raw_import_data: null }, { raw_import_data: { hash } }],
      [],
    );
    const result = await findExistingHashes(supabase, "user-1", [hash]);
    expect(result.has(hash)).toBe(true);
  });
});
