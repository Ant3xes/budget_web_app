/**
 * Strings repeated across many domains (CRUD buttons, generic states) — one
 * place to keep them consistent instead of re-writing "Modifier"/"Supprimer"
 * in every form/list across the app.
 */
export const common = {
  actions: {
    edit: "Modifier",
    delete: "Supprimer",
    cancel: "Annuler",
    create: "Créer",
    update: "Mettre à jour",
    save: "Enregistrer",
    close: "Fermer",
    new: "Nouveau",
    confirm: "Confirmer",
    viewAll: "Voir tout",
  },
  state: {
    loading: "Chargement…",
    saving: "Sauvegarde…",
    none: "Aucun",
    noResults: "Aucun résultat",
    result: "résultat",
  },
  pagination: {
    previous: "Préc.",
    next: "Suiv.",
    pageOf: "page {page} / {totalPages}",
  },
} as const;
