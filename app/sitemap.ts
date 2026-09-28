import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Uniquement les pages publiques, non authentifiées (voir issue #89) : les pages
// applicatives derrière l'auth ne sont pas indexables (voir app/robots.ts) et n'ont
// donc pas leur place ici. Les pages légales (/legal/rgpd, /legal/cgu) sont omises
// tant qu'elles n'existent pas encore (issue #1) — à ajouter dès leur création.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/login`,
      changeFrequency: "yearly",
      priority: 1,
    },
    {
      url: `${siteUrl}/signup`,
      changeFrequency: "yearly",
      priority: 0.8,
    },
  ];
}
