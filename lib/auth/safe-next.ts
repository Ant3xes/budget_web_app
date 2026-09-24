/**
 * Validates the `next` parameter carried through login/signup ("where to go
 * once signed in"). Only same-site paths are accepted: a value like
 * `//evil.example` or `/\evil.example` is treated by browsers as another
 * origin, which would turn the login redirect into an open redirect.
 */
export const safeNext = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f]/.test(value)) {
    return null;
  }
  return value;
};

/** `?next=<path>` suffix for links to /login and /signup, or "" when there is none. */
export const nextQuery = (next: string | null | undefined, prefix: "?" | "&" = "?") =>
  next ? `${prefix}next=${encodeURIComponent(next)}` : "";
