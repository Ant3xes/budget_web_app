export const common = {
  actions: {
    edit: "Edit",
    delete: "Delete",
    cancel: "Cancel",
    create: "Create",
    update: "Update",
    save: "Save",
    close: "Close",
    new: "New",
    confirm: "Confirm",
    viewAll: "View all",
  },
  state: {
    loading: "Loading…",
    saving: "Saving…",
    none: "None",
    noResults: "No results",
    result: "result",
  },
  pagination: {
    previous: "Prev.",
    next: "Next",
    pageOf: "page {page} / {totalPages}",
  },
  filters: {
    trigger: "Filters",
    title: "Filters",
  },
  notFound: {
    title: "Page not found",
    description: "The page you are looking for does not exist or has moved.",
    backAuthenticated: "Back to dashboard",
    backAnonymous: "Back to login",
  },
} as const;
