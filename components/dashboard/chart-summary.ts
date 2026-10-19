type ChartRow = Record<string, unknown>;

function isChartRow(value: unknown): value is ChartRow {
  return typeof value === "object" && value !== null;
}

/** Keep the textual alternative independent of SVG layout (issue 168). */
export function describeChartData(data: readonly unknown[], keys: readonly string[], locale: string): string {
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return data.filter(isChartRow).map((row) => {
    const label = row.month ?? row.label ?? row.name ?? row.date ?? "";
    const values = keys.flatMap((key) => {
      const value = row[key];
      return typeof value === "number" ? [number.format(value)] : [];
    });
    return `${String(label)}: ${values.join(" / ")}`;
  }).join("; ");
}
