import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Paramètres",
  description: "Catégories, règles d'import et profil.",
};

export default function SettingsPage() {
  redirect("/settings/categories");
}
