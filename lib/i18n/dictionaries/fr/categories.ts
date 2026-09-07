/**
 * Category "kind" labels + the 17 default categories seeded by
 * seed_default_categories() (supabase/migrations/*_seed_categories.sql,
 * *_add_category_defaults_i18n.sql). The `defaults` keys must match each
 * seeded row's `translation_key` exactly — see lib/i18n/category-name.ts.
 */
export const categories = {
  kind: {
    expense: "Dépense",
    income: "Revenu",
    transfer: "Virement",
  },
  defaults: {
    alimentation: "Alimentation",
    logement: "Logement",
    transport: "Transport",
    sante: "Santé",
    loisirs: "Loisirs",
    vetements: "Vêtements",
    restaurants: "Restaurants",
    voyages: "Voyages",
    abonnements: "Abonnements",
    education: "Education",
    cadeaux: "Cadeaux",
    banque_frais: "Banque & Frais",
    salaire: "Salaire",
    freelance: "Freelance",
    remboursement: "Remboursement",
    autre_revenu: "Autre revenu",
    virement_interne: "Virement interne",
  },
} as const;
