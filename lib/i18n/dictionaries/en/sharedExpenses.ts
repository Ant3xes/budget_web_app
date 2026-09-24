/** Sharing a transaction into a shared space (components/transactions/share-*, Partage default split). */
export const sharedExpenses = {
  row: {
    share: "Share with a shared space",
    manage: "Manage sharing",
    badge: "Shared",
    badgeIn: "Shared · {space}",
  },
  modal: {
    titleNew: "Share this expense",
    titleEdit: "Manage sharing",
    intro: "The transaction stays in your personal space. A copy is added to the shared space's balance.",
    space: "Shared space",
    selectPlaceholder: "Choose a space",
    category: "Category in the shared space",
    noCategory: "No category",
    myShare: "My share (%)",
    shareInvalid: "Enter a percentage between 0 and 100",
    preview: "You bear {me} %, the other member(s) {others} %",
    amounts: "You: {mine} · Other member(s): {others}",
    noSharedSpace: "You don't belong to any shared space yet. Create one or accept an invitation to share expenses.",
    goToInvitations: "Go to Sharing",
    submitShare: "Share",
    submitUpdate: "Save",
    unshare: "Stop sharing",
    unshareConfirmTitle: "Stop sharing this expense?",
    unshareConfirmDescription:
      "The expense is removed from the shared space's balance. Your personal transaction is not affected.",
    saveError: "Unable to save the sharing",
    unshareError: "Unable to stop sharing",
  },
  defaultSplit: {
    heading: "Default split",
    description:
      "Share of an expense borne by the member who paid it, when they share it into this space. The rest is divided equally among the other members.",
    label: "Payer's share (%)",
    readOnly: "Only the space owner can change the default split.",
    save: "Save",
    saved: "Saved",
    invalid: "Enter a whole percentage between 0 and 100",
    error: "Unable to save the default split",
  },
} as const;
