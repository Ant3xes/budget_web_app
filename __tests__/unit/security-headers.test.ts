import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";
import { buildCsp } from "@/lib/csp/build-csp";

describe("security headers (issue 163)", () => {
  it("sets the static headers on every route and keeps HSTS", async () => {
    const [rule] = await nextConfig.headers!();
    const headers = Object.fromEntries(rule!.headers.map((h) => [h.key, h.value]));
    expect(rule!.source).toBe("/:path*");
    expect(headers["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
  });
});

describe("buildCsp (issue 163)", () => {
  const csp = buildCsp({ nonce: "abc", isDev: false, supabaseUrl: "https://proj.supabase.co" });

  it("carries the nonce on scripts and styles", () => {
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-abc'");
    expect(csp).not.toContain("unsafe-eval");
  });

  it("allows the Supabase origin (https + wss) in connect-src", () => {
    expect(csp).toContain("connect-src 'self' https://proj.supabase.co wss://proj.supabase.co");
  });

  it("forbids framing, plugins and foreign base/form targets", () => {
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
      expect(csp).toContain(d);
    }
  });

  it("allows unsafe-eval in development only, and survives a missing/invalid Supabase URL", () => {
    expect(buildCsp({ nonce: "n", isDev: true })).toContain("'unsafe-eval'");
    expect(buildCsp({ nonce: "n", isDev: false, supabaseUrl: "not a url" })).toContain("connect-src 'self';");
  });
});
