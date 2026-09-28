import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Uniquement les pages publiques, non authentifiées (voir issue #89) : les pages
// applicatives derrière l'auth ne sont pas indexables (voir app/robots.ts) et n'ont
// donc pas leur place ici. Pages légales (/rgpd, /cgu) ajoutées dès leur création
// par l'issue #88.
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
    {
      url: `${siteUrl}/rgpd`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/cgu`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
