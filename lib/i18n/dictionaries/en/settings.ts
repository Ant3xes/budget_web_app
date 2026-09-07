export const settings = {
  categories: {
    title: "Categories",
    newButton: "+ New category",
    emptyForKind: "No categories",
    deleteConfirmTitle: "Delete this category?",
    deleteConfirmDescription: 'The category "{name}" will be deleted.',
    modal: {
      newTitle: "New category",
      editTitle: "Edit category",
    },
    form: {
      name: "Name",
      nameRequired: "Name is required",
      type: "Type",
      icon: "Icon (emoji)",
      iconPlaceholder: "e.g. 🛒",
      color: "Color",
      saveError: "Could not save",
    },
  },
} as const;
