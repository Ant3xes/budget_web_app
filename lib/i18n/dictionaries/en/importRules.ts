/**
 * "Règles d'import" settings page (app/(app)/settings/import-rules/page.tsx)
 * + its list (import-rules-list.tsx) and create/edit modal
 * (import-rules-modal.tsx). Rule "kind" (expense/income) labels reuse
 * `categories.kind.*` rather than duplicating them here.
 */
export const importRules = {
  title: "Import rules",
  description: "Rules apply automatically during CSV import, in the order defined below.",
  dragHandle: "Drag",
  editRule: "Edit rule",
  deleteRule: "Delete rule",
  reorderHint: "Drag and drop to reorder (priority from top to bottom)",
  newRule: "New rule",
  countSingular: "rule",
  countPlural: "rules",
  empty: "No categorization rules. Rules apply automatically during CSV import.",
  deleteConfirmTitle: "Delete this rule?",
  deleteConfirmDescription: "The rule “{keyword}” will be deleted.",
  form: {
    keywordLabel: "Keyword",
    keywordPlaceholder: "e.g. Netflix, Lidl, Rent…",
    keywordHint: "If a transaction's description contains this keyword, the category will be applied automatically.",
    keywordRequired: "Keyword is required",
    kindLabel: "Transaction type",
    categoryLabel: "Category to assign",
    categoryPlaceholder: "Select a category…",
    categoryRequired: "Category is required",
    saveError: "Unable to save",
    saving: "Saving…",
  },
} as const;
