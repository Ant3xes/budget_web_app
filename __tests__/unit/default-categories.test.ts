import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { categories as fr } from "@/lib/i18n/dictionaries/fr/categories";
import { categories as en } from "@/lib/i18n/dictionaries/en/categories";

// issue 126: the seed function in the latest migration is the source of truth.
const sql = readFileSync(
  "supabase/migrations/20261015100000_default_categories_30.sql",
  "utf8",
);
const seedFn = sql.slice(0, sql.indexOf("-- Backfill"));
const keys = [...seedFn.matchAll(/true, '([a-z_]+)'\)/g)].map((m) => m[1]);

describe("default categories", () => {
  it("seeds 30 unique translation keys", () => {
    expect(keys).toHaveLength(30);
    expect(new Set(keys).size).toBe(30);
  });

  it("has a non-empty fr and en label for every key", () => {
    for (const key of keys) {
      expect(fr.defaults[key as keyof typeof fr.defaults], key).toBeTruthy();
      expect(en.defaults[key as keyof typeof en.defaults], key).toBeTruthy();
    }
    expect(Object.keys(fr.defaults).sort()).toEqual([...keys].sort());
    expect(Object.keys(en.defaults).sort()).toEqual([...keys].sort());
  });

  it("backfill covers exactly the 13 new keys, guarded by not exists", () => {
    const backfill = sql.slice(sql.indexOf("-- Backfill"));
    const bKeys = [...backfill.matchAll(/, '([a-z_]+)'\)/g)].map((m) => m[1]);
    expect(bKeys).toHaveLength(13);
    expect(bKeys.every((k) => keys.includes(k))).toBe(true);
    expect(backfill).toContain("not exists");
    expect(backfill).toContain("deleted_at is null");
  });
});
