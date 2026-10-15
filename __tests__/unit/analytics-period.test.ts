import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AnalyticsPage from "@/app/(app)/analytics/page";
import { CashflowChart } from "@/components/analytics/cashflow-chart";
import { PeriodSelector } from "@/components/period-selector";
import { pillButtonClass } from "@/lib/dashboard/pill-class";

const { requireSpaceContext } = vi.hoisted(() => ({ requireSpaceContext: vi.fn() }));
vi.mock("@/lib/spaces/context", () => ({ requireSpaceContext }));

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [];
    return [child, ...elements(child.props.children)];
  });
}

const transactions = [
  { account_id: "account-test", date: "2026-02-20", kind: "expense", amount_cents: -9000 },
  { account_id: "account-test", date: "2026-03-01", kind: "expense", amount_cents: -1200 },
  { account_id: "account-test", date: "2026-03-15", kind: "income", amount_cents: 5000 },
  { account_id: "account-test", date: "2026-03-16", kind: "expense", amount_cents: -7000 },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 2, 15, 12));
  requireSpaceContext.mockResolvedValue({
    spaceId: "space-test",
    space: { kind: "personal" },
    supabase: {
      from(table: string) {
        let rows: Array<Record<string, unknown>> = table === "accounts"
          ? [{ id: "account-test", initial_balance_cents: 0, balance_anchor_date: "1900-01-01" }]
          : [...transactions];
        const query = {
          select: () => query,
          eq: (key: string, value: unknown) => {
            if (key === "kind") rows = rows.filter((row) => row.kind === value);
            return query;
          },
          is: () => query,
          in: () => query,
          gte: (_key: string, date: string) => {
            rows = rows.filter((row) => typeof row.date === "string" && row.date >= date);
            return query;
          },
          lte: (_key: string, date: string) => {
            rows = rows.filter((row) => typeof row.date === "string" && row.date <= date);
            return query;
          },
          then: (resolve: (result: { data: typeof rows }) => unknown) => resolve({ data: rows }),
        };
        return query;
      },
    },
  });
});

afterEach(() => vi.useRealTimers());

describe("analytics period (issue 120)", () => {
  it("defaults to the current month with only month-to-date activity", async () => {
    const tree = elements(await AnalyticsPage({ searchParams: Promise.resolve({}) }));
    const chart = tree.find((element) => element.type === CashflowChart);
    expect(chart?.props.data).toEqual([{ key: "2026-03", month: "Mar 26", income: 5000, expense: 1200 }]);
    const selectors = tree.filter((element) => element.type === PeriodSelector);
    expect(selectors).toHaveLength(2);
    for (const selector of selectors) {
      expect(selector.props.current).toEqual({ type: "month", month: "2026-03" });
      expect(selector.props.presets).toContain("1m");
    }
  });
});
