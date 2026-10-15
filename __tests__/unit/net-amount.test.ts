import { describe, expect, it } from "vitest";

import {
  EMPTY_REIMBURSEMENTS,
  applyReimbursements,
  buildReimbursementIndex,
  netAmounts,
  netExpenseCents,
  sumReimbursements,
} from "@/lib/transactions/net-amount";

describe("netExpenseCents", () => {
  it("subtracts the reimbursed amount", () => {
    expect(netExpenseCents(-9000, 6000)).toBe(3000);
  });
  it("caps at 0 when reimbursed more than spent", () => {
    expect(netExpenseCents(-9000, 12000)).toBe(0);
  });
  it("accepts positive (shared activity) amounts", () => {
    expect(netExpenseCents(9000, 0)).toBe(9000);
  });
});

describe("sumReimbursements", () => {
  it("adds several reimbursements and ignores non-positive ones", () => {
    expect(sumReimbursements([2000, 4000, -500, 0])).toBe(6000);
  });
});

const links = [
  { id: "r1", expenseId: "gift", amount_cents: 2500 },
  { id: "r2", expenseId: "gift", amount_cents: 3500 },
];

describe("buildReimbursementIndex", () => {
  it("sums several reimbursements of the same expense", () => {
    const index = buildReimbursementIndex(links);
    expect(index.byExpense.get("gift")).toBe(6000);
    expect([...index.linkedSourceIds].sort()).toEqual(["r1", "r2"]);
  });
  it("a removed link no longer counts", () => {
    const index = buildReimbursementIndex(links.filter((l) => l.id !== "r2"));
    expect(index.byExpense.get("gift")).toBe(2500);
    expect(index.linkedSourceIds.has("r2")).toBe(false);
  });
});

describe("applyReimbursements (issue example: 90 € gift, 60 € reimbursed)", () => {
  const index = buildReimbursementIndex(links);
  const rows = [
    { id: "gift", kind: "expense", amount_cents: -9000 },
    { id: "r1", kind: "income", amount_cents: 2500 },
    { id: "r2", kind: "income", amount_cents: 3500 },
    { id: "salary", kind: "income", amount_cents: 200000 },
  ];

  it("counts the expense for 30 € and drops reimbursements from income", () => {
    const out = applyReimbursements(rows, index);
    const expense = out.filter((r) => r.kind === "expense").reduce((s, r) => s + Math.abs(r.amount_cents), 0);
    const income = out.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount_cents, 0);
    expect(expense).toBe(3000);
    expect(income).toBe(200000);
  });

  it("drops a fully reimbursed expense (cap at 0)", () => {
    const full = buildReimbursementIndex([{ id: "r1", expenseId: "gift", amount_cents: 15000 }]);
    const out = applyReimbursements(rows, full);
    expect(out.find((r) => r.id === "gift")).toBeUndefined();
  });

  it("keeps an expense that was never linked and is a no-op without links", () => {
    expect(applyReimbursements(rows, EMPTY_REIMBURSEMENTS)).toEqual(rows);
    expect(applyReimbursements([{ id: "x", amount_cents: -100 }], index)).toEqual([{ id: "x", amount_cents: -100 }]);
  });

  it("does not mutate its input", () => {
    const copy = structuredClone(rows);
    applyReimbursements(rows, index);
    expect(rows).toEqual(copy);
  });
});

describe("netAmounts (lists)", () => {
  it("keeps every row, nets the expense and preserves the sign", () => {
    const index = buildReimbursementIndex(links);
    const out = netAmounts(
      [
        { id: "gift", amount_cents: -9000 },
        { id: "r1", amount_cents: 2500 },
      ],
      index,
    );
    expect(out).toEqual([
      { id: "gift", amount_cents: -3000 },
      { id: "r1", amount_cents: 2500 },
    ]);
  });
  it("keeps a fully reimbursed expense visible at 0", () => {
    const index = buildReimbursementIndex([{ id: "r1", expenseId: "gift", amount_cents: 20000 }]);
    expect(netAmounts([{ id: "gift", amount_cents: -9000 }], index)[0]!.amount_cents).toBe(0);
  });
});
