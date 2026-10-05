import { describe, expect, it } from "vitest";

import {
  LEGACY_BALANCE_ANCHOR_DATE,
  balanceAfterAnchor,
  filterTransactionsAfterAnchor,
  isCountedInBalance,
} from "@/lib/accounts/balance-after-anchor";

describe("isCountedInBalance", () => {
  it("ne compte pas une opération avant l'ancrage", () => {
    expect(isCountedInBalance("2026-03-01", "2026-03-10")).toBe(false);
  });
  it("ne compte pas une opération le jour même de l'ancrage", () => {
    expect(isCountedInBalance("2026-03-10", "2026-03-10")).toBe(false);
  });
  it("compte une opération après l'ancrage", () => {
    expect(isCountedInBalance("2026-03-11", "2026-03-10")).toBe(true);
  });
  it("accepte une date ISO complète (timestamp)", () => {
    expect(isCountedInBalance("2026-03-10T23:00:00Z", "2026-03-10")).toBe(false);
    expect(isCountedInBalance("2026-03-11T00:00:00Z", "2026-03-10")).toBe(true);
  });
  it("ancrage ancien : tout compte (comptes existants)", () => {
    expect(isCountedInBalance("2000-01-01", LEGACY_BALANCE_ANCHOR_DATE)).toBe(true);
  });
});

describe("balanceAfterAnchor", () => {
  const anchor = "2026-03-10";
  const txs = [
    { date: "2026-03-01", amount_cents: -5_000 },
    { date: "2026-03-10", amount_cents: 2_000 },
    { date: "2026-03-11", amount_cents: -1_500 },
    { date: "2026-04-01", amount_cents: 10_000 },
  ];

  it("ne somme que les opérations postérieures à l'ancrage", () => {
    expect(balanceAfterAnchor(100_000, anchor, txs)).toBe(100_000 - 1_500 + 10_000);
  });
  it("sans opération postérieure : solde initial", () => {
    expect(balanceAfterAnchor(100_000, anchor, txs.slice(0, 2))).toBe(100_000);
  });
  it("ancrage ancien = comportement historique (tout compte)", () => {
    expect(balanceAfterAnchor(100_000, LEGACY_BALANCE_ANCHOR_DATE, txs)).toBe(100_000 - 5_000 + 2_000 - 1_500 + 10_000);
  });
  it("ignore les transactions supprimées", () => {
    const withDeleted = [...txs, { date: "2026-05-01", amount_cents: 99_999, deleted_at: "2026-05-02T00:00:00Z" }];
    expect(balanceAfterAnchor(100_000, anchor, withDeleted)).toBe(100_000 - 1_500 + 10_000);
  });
  it("traite les montants numériques reçus en chaîne", () => {
    expect(balanceAfterAnchor(100, anchor, [{ date: "2026-03-12", amount_cents: "250" as unknown as number }])).toBe(350);
  });
});

describe("filterTransactionsAfterAnchor", () => {
  it("filtre transaction par transaction selon l'ancrage de son compte", () => {
    const anchors = new Map([
      ["a", "2026-03-10"],
      ["b", "1900-01-01"],
    ]);
    const kept = filterTransactionsAfterAnchor(
      [
        { account_id: "a", date: "2026-03-05", amount_cents: 1 },
        { account_id: "a", date: "2026-03-20", amount_cents: 2 },
        { account_id: "b", date: "2026-03-05", amount_cents: 4 },
        { account_id: "z", date: "2026-03-05", amount_cents: 8 },
      ],
      anchors,
    );
    expect(kept.map((t) => t.amount_cents)).toEqual([2, 4, 8]);
  });
});
