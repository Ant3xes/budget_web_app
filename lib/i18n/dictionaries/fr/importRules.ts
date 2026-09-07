/**
 * "Règles d'import" settings page (app/(app)/settings/import-rules/page.tsx)
 * + its list (import-rules-list.tsx) and create/edit modal
 * (import-rules-modal.tsx). Rule "kind" (expense/income) labels reuse
 * `categories.kind.*` rather than duplicating them here.
 */
export const importRules = {
  title: "Règles d'import",
  description: "Les règles s'appliquent automatiquement lors de l'import CSV, dans l'ordre défini ci-dessous.",
  dragHandle: "Déplacer",
  editRule: "Modifier la règle",
  deleteRule: "Supprimer la règle",
  reorderHint: "Glisser-déposer pour réordonner (priorité du haut vers le bas)",
  newRule: "Nouvelle règle",
  countSingular: "règle",
  countPlural: "règles",
  empty: "Aucune règle de catégorisation. Les règles s'appliquent automatiquement lors de l'import CSV.",
  deleteConfirmTitle: "Supprimer cette règle ?",
  deleteConfirmDescription: "La règle « {keyword} » sera supprimée.",
  form: {
    keywordLabel: "Mot-clé",
    keywordPlaceholder: "ex: Netflix, Lidl, Loyer…",
    keywordHint: "Si la description d'une transaction contient ce mot-clé, la catégorie sera appliquée automatiquement.",
    keywordRequired: "Mot-clé requis",
    kindLabel: "Type de transaction",
    categoryLabel: "Catégorie à assigner",
    categoryPlaceholder: "Sélectionner une catégorie…",
    categoryRequired: "Catégorie requise",
    saveError: "Impossible de sauvegarder",
    saving: "Enregistrement…",
  },
} as const;
