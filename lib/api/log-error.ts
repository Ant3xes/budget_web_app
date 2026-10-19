/**
 * Server log of an error without ever dumping the full object (public repo,
 * banking data): only the Postgres code and a truncated message (issue 163).
 */
export const logApiError = (context: string, error: unknown) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code: unknown }).code) : undefined;
  const message = error instanceof Error ? error.message : typeof error === "object" && error !== null && "message" in error ? String((error as { message: unknown }).message) : "";
  console.error(`${context}${code ? ` [${code}]` : ""}: ${message.slice(0, 200)}`);
};
