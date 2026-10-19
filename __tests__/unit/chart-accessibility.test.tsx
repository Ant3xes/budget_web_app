// @vitest-environment jsdom
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cloneElement, isValidElement, type ReactNode } from "react";

import { LocaleProvider } from "@/components/locale-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { NetWorthChart } from "@/components/analytics/net-worth-chart";
import { IncomeExpenseBarChart } from "@/components/dashboard/bar-chart";
import { DonutChart } from "@/components/dashboard/donut-chart";
import { BalanceChart } from "@/components/accounts/balance-chart";
import { DeferredChart } from "@/components/analytics/deferred-charts";
import { describeChartData } from "@/components/dashboard/chart-summary";

vi.mock("@/components/theme-provider", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/hooks/use-is-mobile", () => ({ useIsMobile: () => false }));
vi.mock("recharts", async (importOriginal) => {
  const original = await importOriginal<typeof import("recharts")>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => isValidElement<{ width: number; height: number }>(children)
      ? cloneElement(children, { width: 320, height: 240 }) : children,
  };
});

afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

function Providers({ children }: { children: ReactNode }) {
  return <LocaleProvider><ThemeProvider>{children}</ThemeProvider></LocaleProvider>;
}

describe("chart alternatives (issue 168)", () => {
  for (const locale of ["fr", "en"]) {
    it(`renders the net worth values and series name in ${locale}`, () => {
      localStorage.setItem("locale", locale);
      render(<Providers><NetWorthChart data={[{ month: "Mar 26", balance: 12000 }]} /></Providers>);
      const image = screen.getByRole("img");
      expect(image.getAttribute("aria-label")).toContain(locale === "fr" ? "Patrimoine net" : "Net worth");
      expect(image.getAttribute("aria-label")).toContain("Mar 26");
      expect(image.getAttribute("aria-label")).toMatch(/12\D?000/);
    });
  }

  it("renders income/expense, donut and account balance alternatives", () => {
    render(<Providers>
      <IncomeExpenseBarChart data={[{ month: "Mar 26", income: 20000, expense: 15000 }]} />
      <DonutChart data={[{ name: "Courses", value: 15000, color: "#777" }]} />
      <BalanceChart data={[{ date: "2026-03-01", label: "Mars", balance: 5000 }]} />
    </Providers>);
    const labels = screen.getAllByRole("img").map((node) => node.getAttribute("aria-label")).join(" ");
    expect(labels).toContain("Mar 26");
    expect(labels).toContain("Courses");
    expect(labels).toContain("Mars");
    expect(labels).toMatch(/15\D?000/);
    expect(labels).toMatch(/5\D?000/);
  });

  it("ignores metadata while preserving zero and negative values", () => {
    expect(describeChartData([{ label: "A", balance: -25, color: "red" }, { label: "B", balance: 0 }], ["balance"], "en"))
      .toBe("A: -25; B: 0");
  });

  it("reserves identical space until intersection, then mounts once", () => {
    let notify: (() => void) | undefined;
    const disconnect = vi.fn();
    vi.stubGlobal("IntersectionObserver", class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { notify = () => callback([{ isIntersecting: true }]); }
      observe() {}
      disconnect = disconnect;
    });
    const { container } = render(<Providers><DeferredChart height={280}><span>Loaded chart</span></DeferredChart></Providers>);
    expect(screen.queryByText("Loaded chart")).toBeNull();
    expect(container.querySelector<HTMLElement>("[data-deferred-chart]")?.style.minHeight).toBe("280px");
    act(() => notify?.());
    expect(screen.getByText("Loaded chart")).toBeTruthy();
    expect(container.querySelector<HTMLElement>("[data-deferred-chart]")?.style.minHeight).toBe("280px");
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
