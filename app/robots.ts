import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Toutes les routes applicatives sont derrière l'auth et ne doivent pas être indexées
// (données personnelles/bancaires) — seules /login, /signup, /plan (roadmap publique)
// et les pages légales /rgpd, /cgu sont autorisées. /invite/* porte un token à usage
// unique, jamais indexable non plus.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login", "/signup", "/plan", "/rgpd", "/cgu"],
      disallow: [
        "/api",
        "/dashboard",
        "/transactions",
        "/accounts",
        "/analytics",
        "/balance",
        "/budget",
        "/fixed-charges",
        "/goals",
        "/invitations",
        "/settings",
        "/invite",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
