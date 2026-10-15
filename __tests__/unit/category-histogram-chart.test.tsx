// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CategoryHistogramChart } from "@/components/analytics/category-histogram-chart";

vi.mock("@/components/locale-provider", () => ({ useLocale: () => ({ t: (k: string) => k }) }));
// recharts needs real layout (jsdom has none): stand-in listing the bars it would draw.
vi.mock("@/components/analytics/diverging-bar-chart", () => ({
  DivergingBarChart: ({ data }: { data: { id: string; label: string }[] }) => (
    <ul data-testid="bars">
      {data.map((d) => (
        <li key={d.id}>{d.label}</li>
      ))}
    </ul>
  ),
}));

afterEach(cleanup);

const data = [
  { name: "Courses", value: 3000, color: "#111" },
  { name: "Loyer", value: 9000, color: "#222" },
];

describe("CategoryHistogramChart", () => {
  it("draws every category sorted by amount, all switches on", () => {
    render(<CategoryHistogramChart data={data} />);
    const bars = screen.getByTestId("bars");
    expect([...bars.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Loyer", "Courses"]);
    expect(screen.getAllByRole("switch").every((s) => (s as HTMLInputElement).checked)).toBe(true);
  });

  it("removes the bar when its switch is turned off, and brings it back", () => {
    render(<CategoryHistogramChart data={data} />);
    const loyerSwitch = screen.getByRole("switch", { name: /Loyer/ });
    fireEvent.click(loyerSwitch);
    const bars = screen.getByTestId("bars");
    expect([...bars.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Courses"]);
    fireEvent.click(loyerSwitch);
    expect(bars.querySelectorAll("li")).toHaveLength(2);
  });

  it("shows a message when every category is hidden", () => {
    render(<CategoryHistogramChart data={data} />);
    screen.getAllByRole("switch").forEach((s) => fireEvent.click(s));
    expect(screen.queryByTestId("bars")).toBeNull();
    expect(screen.getByText("analytics.categoryHistogram.allHidden")).toBeTruthy();
  });
});
