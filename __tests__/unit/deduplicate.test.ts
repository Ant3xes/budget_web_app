import { describe, expect, it } from "vitest";

import { buildHash } from "@/lib/import/deduplicate";

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
