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
        ],
      },
    ];
  },
};

export default nextConfig;
