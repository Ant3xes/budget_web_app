/**
 * In-memory brute-force guard for `login`/`signup` (`app/(auth)/actions.ts`,
 * issue #90). Keyed by caller (email + IP, built by the caller) rather than
 * hard-coding one dimension: blocks both "one IP spraying many emails" and
 * "one email hammered from many IPs" scenarios reasonably well without two
 * separate stores.
 *
 * Known limitation, accepted for this iteration (issue #90's acceptance
 * criteria don't require DB persistence): Vercel serverless functions don't
 * share memory across instances/cold starts, so this only throttles repeats
 * that land on the same warm lambda — not a distributed rate limit. Good
 * enough against casual/scripted brute force; revisit with a Supabase-backed
 * counter if it proves insufficient in practice.
 */

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_MAX_ATTEMPTS = 5;

type Entry = { count: number; windowStart: number };

export type RateLimitStore = Map<string, Entry>;

export const createRateLimitStore = (): RateLimitStore => new Map();

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterMs: number };

/** Read-only check — does not itself count as an attempt (call `recordFailedAttempt` on actual failure). */
export function checkRateLimit(
  store: RateLimitStore,
  key: string,
  now: number = Date.now(),
): RateLimitResult {
  const entry = store.get(key);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    return { allowed: true };
  }
  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { allowed: false, retryAfterMs: RATE_LIMIT_WINDOW_MS - (now - entry.windowStart) };
  }
  return { allowed: true };
}

/** Call once per failed attempt (wrong password, etc.) — never on success. */
export function recordFailedAttempt(store: RateLimitStore, key: string, now: number = Date.now()): void {
  const entry = store.get(key);
  if (!entry || now - entry.windowStart >= RATE_LIMIT_WINDOW_MS) {
    store.set(key, { count: 1, windowStart: now });
    return;
  }
  entry.count += 1;
}

/** Call on a successful login so a legitimate user who mistyped once isn't left half-throttled. */
export function resetAttempts(store: RateLimitStore, key: string): void {
  store.delete(key);
}
