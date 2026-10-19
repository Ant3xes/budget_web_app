/** Require a fixture or mock entry to exist; missing entries fail the test immediately. */
export function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Expected a defined test value");
  return value;
}
