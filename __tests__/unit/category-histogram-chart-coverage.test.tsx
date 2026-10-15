// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { LocaleProvider } from "@/components/locale-provider";
import { CategoryHistogramChart } from "@/components/analytics/category-histogram-chart";
afterEach(cleanup);
it("shows the empty-data state without chart or switches when there are no categories", () => {
  render(<LocaleProvider><CategoryHistogramChart data={[]} /></LocaleProvider>);
  expect(screen.getByText("Pas encore de données")).toBeTruthy();
  expect(screen.queryByRole("switch")).toBeNull();
  expect(screen.queryByRole("list")).toBeNull();
});
