/** Resolve the demo sentinel with the client's locale (issue 166). */
export function apiErrorMessage(error: string | null | undefined, fallback: string, t: (key: string) => string): string {
  return error === "Compte demo en lecture seule" ? t("common.demo.readOnly") : error ?? fallback;
}
