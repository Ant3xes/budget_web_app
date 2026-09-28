import type { Metadata } from "next";

// `settings/categories/page.tsx` est un composant client ("use client") et ne peut
// donc pas exporter `metadata` lui-même — ce layout serveur minimal porte le titre
// de la page à sa place, comme le reste de `app/(app)/*`.
export const metadata: Metadata = {
  title: "Catégories",
  description: "Catégories de dépenses, revenus et virements.",
};

export default function CategoriesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
