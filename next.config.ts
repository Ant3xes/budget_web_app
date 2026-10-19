import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // All routes: HTTPS is already enforced by Vercel at the platform
        // level, but the app sends its own HSTS header too rather than
        // depend solely on that (issue #90) — 2 years, subdomains included,
        // eligible for browser preload lists.
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Issue 163. The CSP itself (with nonce) is set in proxy.ts.
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
          // Enforced already: frame-ancestors is the one directive with no
          // risk of breaking the app. The rest is Report-Only (see proxy.ts).
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ];
  },
};

export default nextConfig;
