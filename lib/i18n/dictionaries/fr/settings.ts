export const settings = {
  categories: {
    title: "Catégories",
    newButton: "+ Nouvelle catégorie",
    emptyForKind: "Aucune catégorie",
    deleteConfirmTitle: "Supprimer cette catégorie ?",
    deleteConfirmDescription: 'La catégorie "{name}" sera supprimée.',
    modal: {
      newTitle: "Nouvelle catégorie",
      editTitle: "Modifier la catégorie",
    },
    form: {
      name: "Nom",
      nameRequired: "Nom requis",
      type: "Type",
      icon: "Icône (emoji)",
      iconPlaceholder: "ex: 🛒",
      color: "Couleur",
      saveError: "Impossible de sauvegarder",
    },
  },
} as const;
