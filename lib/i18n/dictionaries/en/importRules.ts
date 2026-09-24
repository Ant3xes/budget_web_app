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
  sharedBadge: "Shared · {space}",
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
    shareToggle: "Share into a shared space",
    shareHint: "Imported expenses matching this rule will be suggested for sharing (you can uncheck them during import).",
    shareSpace: "Shared space",
    shareSpacePlaceholder: "Choose a space",
    shareSpaceRequired: "Choose a shared space",
    shareCategory: "Category in the shared space",
    shareNoCategory: "No category",
    sharePercent: "My share (%)",
    sharePercentHint: "Leave empty to follow the space's default split.",
    sharePercentInvalid: "Invalid share (0 to 100)",
    saving: "Saving…",
  },
} as const;
