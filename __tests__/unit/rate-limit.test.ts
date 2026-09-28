import { describe, expect, it } from "vitest";

import {
  RATE_LIMIT_MAX_ATTEMPTS,
  RATE_LIMIT_WINDOW_MS,
  checkRateLimit,
  createRateLimitStore,
  recordFailedAttempt,
  resetAttempts,
} from "@/lib/auth/rate-limit";

describe("rate-limit", () => {
  it("allows attempts under the threshold", () => {
    const store = createRateLimitStore();
    const key = "a@test.com:127.0.0.1";
    const now = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS - 1; i++) {
      expect(checkRateLimit(store, key, now).allowed).toBe(true);
      recordFailedAttempt(store, key, now);
    }

    // One legitimate mistake (or two) should never be blocked.
    expect(checkRateLimit(store, key, now).allowed).toBe(true);
  });

  it("blocks the attempt after RATE_LIMIT_MAX_ATTEMPTS failures within the window", () => {
    const store = createRateLimitStore();
    const key = "a@test.com:127.0.0.1";
    const now = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      recordFailedAttempt(store, key, now);
    }

    const result = checkRateLimit(store, key, now);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBe(RATE_LIMIT_WINDOW_MS);
    }
  });

  it("expires the counter once the window has elapsed", () => {
    const store = createRateLimitStore();
    const key = "a@test.com:127.0.0.1";
    const start = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      recordFailedAttempt(store, key, start);
    }
    expect(checkRateLimit(store, key, start).allowed).toBe(false);

    // Exactly at window end: no longer limited.
    expect(checkRateLimit(store, key, start + RATE_LIMIT_WINDOW_MS).allowed).toBe(true);

    // A fresh failure past the window starts a brand new window, not a
    // continuation of the old (exhausted) one.
    recordFailedAttempt(store, key, start + RATE_LIMIT_WINDOW_MS);
    expect(checkRateLimit(store, key, start + RATE_LIMIT_WINDOW_MS).allowed).toBe(true);
  });

  it("keeps separate counters per key (does not cross-block other emails/IPs)", () => {
    const store = createRateLimitStore();
    const now = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      recordFailedAttempt(store, "victim@test.com:1.1.1.1", now);
    }

    expect(checkRateLimit(store, "victim@test.com:1.1.1.1", now).allowed).toBe(false);
    expect(checkRateLimit(store, "other@test.com:1.1.1.1", now).allowed).toBe(true);
    expect(checkRateLimit(store, "victim@test.com:2.2.2.2", now).allowed).toBe(true);
  });

  it("resetAttempts clears the counter after a successful login", () => {
    const store = createRateLimitStore();
    const key = "a@test.com:127.0.0.1";
    const now = 1_000_000;

    for (let i = 0; i < RATE_LIMIT_MAX_ATTEMPTS; i++) {
      recordFailedAttempt(store, key, now);
    }
    expect(checkRateLimit(store, key, now).allowed).toBe(false);

    resetAttempts(store, key);
    expect(checkRateLimit(store, key, now).allowed).toBe(true);
  });
});
