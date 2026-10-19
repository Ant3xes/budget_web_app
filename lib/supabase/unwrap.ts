/** The part of a Supabase/PostgREST response that `unwrap` reads. */
export type SupabaseResult<D> = { data: D; error?: { message: string; code?: string } | null };

/** Raised when a Supabase call answered with an `error` (carries the PostgREST code when present). */
export class SupabaseQueryError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "SupabaseQueryError";
    this.code = code;
  }
}

/**
 * Returns `res.data`, or throws when the call failed (issue 162). Reading
 * `data ?? []` without looking at `error` turned any failure into a dashboard
 * full of zeros; throwing lets the route's error.tsx show a retry instead.
 */
export function unwrap<D>(res: SupabaseResult<D>): D {
  if (res.error) {
    throw new SupabaseQueryError(res.error.message, res.error.code);
  }
  return res.data;
}
