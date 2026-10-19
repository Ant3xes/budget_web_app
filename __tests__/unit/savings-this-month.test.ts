import { isValidElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeSavingsThisMonthCents } from "@/lib/dashboard/savings-this-month";
import { SavingsThisMonth } from "@/components/dashboard/savings-this-month";

const { requireSpaceContext } = vi.hoisted(() => ({ requireSpaceContext: vi.fn() }));
vi.mock("@/lib/spaces/context", () => ({ requireSpaceContext }));

import { dashboardRpc } from "./helpers/dashboard-rpc-fake";
import DashboardPage from "@/app/(app)/dashboard/page";

describe("computeSavingsThisMonthCents", () => {
  it("nets a 300 euro deposit and a 100 euro withdrawal to 20000 cents", () => {
    expect(computeSavingsThisMonthCents([
      { amount_cents: 30000 },
      { amount_cents: -10000 },
    ])).toBe(20000);
  });

  it("returns zero without movements", () => {
    expect(computeSavingsThisMonthCents([])).toBe(0);
  });

  it("preserves negative net savings", () => {
    expect(computeSavingsThisMonthCents([{ amount_cents: -10000 }])).toBe(-10000);
  });
});

type Row = Record<string, string | number | null>;

// Apply the dashboard's actual query predicates to synthetic rows, not a
// separately reimplemented savings filter (issue 124).
function queryRows(rows: Row[]) {
  let filtered = rows;
  const query = {
    select: () => query,
    eq: (key: string, value: unknown) => filter((row) => row[key] === value),
    is: (key: string, value: unknown) => filter((row) => row[key] === value),
    // Reimbursement links (issue 123): none in these fixtures.
    not: () => filter(() => true),
    range: () => query,
    in: (key: string, values: unknown[]) => filter((row) => values.includes(row[key])),
    gte: (key: string, value: string) => filter((row) => String(row[key]) >= value),
    lt: (key: string, value: string) => filter((row) => String(row[key]) < value),
    lte: (key: string, value: string) => filter((row) => String(row[key]) <= value),
    order: () => query,
    limit: () => query,
    then: (resolve: (result: { data: Row[]; error: null }) => unknown) =>
      Promise.resolve({ data: filtered, error: null }).then(resolve),
  };
  function filter(predicate: (row: Row) => boolean) {
    filtered = filtered.filter(predicate);
    return query;
  }
  return query;
}

function savingsAmount(node: ReactNode): number | undefined {
  if (Array.isArray(node)) {
    return node.map(savingsAmount).find((value) => value !== undefined);
  }
  if (!isValidElement<{ children?: ReactNode; amountCents?: number }>(node)) return;
  if (node.type === SavingsThisMonth) return node.props.amountCents;
  return savingsAmount(node.props.children);
}

describe("dashboard savings query and calculation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  async function amountFor(transactions: Row[]) {
    const accounts = ["courant", "epargne", "livret", "pel", "autre"].map((type) => ({
      id: type, name: type, type, space_id: "space-test", deleted_at: null,
      bank: null, initial_balance_cents: 0, balance_anchor_date: "2026-10-15",
    }));
    requireSpaceContext.mockResolvedValue({
      spaceId: "space-test",
      space: { kind: "personal" },
      supabase: {
        from: (table: string) => queryRows(
          table === "accounts" ? accounts : table === "transactions" ? transactions : [],
        ),
        rpc: (name: string, args: Record<string, unknown>) =>
          Promise.resolve({ data: dashboardRpc(name, args, { accounts, transactions }), error: null }),
      },
    });
    const page = await DashboardPage({
      searchParams: Promise.resolve({ period: "2025-01", accounts: "" }),
    });
    return savingsAmount(page);
  }

  function tx(amount_cents: number, overrides: Row = {}): Row {
    return {
      account_id: "epargne", amount_cents, date: "2026-10-15",
      deleted_at: null, space_id: "space-test", kind: "transfer", ...overrides,
    };
  }

  it("nets deposits and withdrawals regardless of the activity filters or balance anchor", async () => {
    expect(await amountFor([
      tx(-30000, { account_id: "courant" }), tx(30000),
      tx(-10000), tx(10000, { account_id: "courant" }),
    ])).toBe(20000);
  });

  it("includes every non-courant account and transaction kind", async () => {
    expect(await amountFor([
      tx(30000), tx(10000, { account_id: "livret", kind: "income" }),
      tx(-5000, { account_id: "pel", kind: "expense" }),
      tx(2000, { account_id: "autre" }),
    ])).toBe(37000);
  });

  it("nets a transfer between two savings accounts to zero", async () => {
    expect(await amountFor([tx(-30000), tx(30000, { account_id: "livret" })])).toBe(0);
  });

  it("ignores deleted transactions", async () => {
    expect(await amountFor([
      tx(30000), tx(-10000), tx(50000, { deleted_at: "2026-10-16T12:00:00Z" }),
    ])).toBe(20000);
  });

  it("includes the first and last day but excludes both adjacent months", async () => {
    expect(await amountFor([
      tx(30000, { date: "2026-10-01" }), tx(-10000, { date: "2026-10-31" }),
      tx(50000, { date: "2026-09-30" }), tx(70000, { date: "2026-11-01" }),
    ])).toBe(20000);
  });
});
