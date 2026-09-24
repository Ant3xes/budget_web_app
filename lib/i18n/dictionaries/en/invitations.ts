/**
 * "Sharing" page (app/(app)/invitations/page.tsx, components/spaces/*,
 * invite-form.tsx) and the public accept-invitation page
 * (app/invite/[token]/page.tsx).
 */
export const invitations = {
  title: "Sharing",
  current: {
    heading: "Active space: {space}",
    personalDescription:
      "Your personal space is private: nobody else can access it. Create a shared space to manage a joint budget.",
    sharedDescription:
      "Every member sees and edits the same accounts, budgets and transactions in this space.",
  },
  create: {
    heading: "Create a shared space",
    description:
      "For example \"Home\" for your joint account. You will own it and can invite other people.",
    nameLabel: "Space name",
    namePlaceholder: "Home",
    nameRequired: "A name is required",
    submit: "Create space",
    error: "Unable to create the space",
  },
  members: {
    heading: "Members",
    owner: "Owner",
    member: "Member",
    you: "you",
    remove: "Remove",
    removeConfirmTitle: "Remove this member?",
    removeConfirmDescription: "They will lose access to this space. What they entered stays in the space.",
  },
  invite: {
    heading: "Invite someone",
    description: "The invited person joins this space with the same rights as you on its data.",
    emailLabel: "Email",
    emailInvalid: "A valid email is required",
    submit: "Create invitation link",
    createError: "Unable to create invitation",
    createdSuccess: "Invitation created. Send them this link: {link}",
  },
  recent: {
    heading: "Invitations",
    empty: "No invitations for this space.",
  },
  status: {
    pending: "Pending",
    accepted: "Accepted",
    revoked: "Revoked",
  },
  revoke: "Revoke",
  danger: {
    heading: "Danger zone",
    leave: "Leave space",
    leaveConfirmTitle: "Leave this space?",
    leaveConfirmDescription: "You will lose access to it. What you entered stays in the space.",
    delete: "Delete space",
    deleteConfirmTitle: "Delete this space?",
    deleteConfirmDescription:
      "All its accounts, transactions and budgets will be deleted for every member. This cannot be undone.",
    confirming: "Working…",
    cancel: "Cancel",
    error: "Action failed",
  },
  accept: {
    notFound: "This invitation does not exist.",
    unavailable: "This invitation is no longer valid (already used, revoked or expired).",
    summary: "{inviter} invites you to join the space \"{space}\".",
    signInPrompt: "Sign in or create an account to accept the invitation.",
    signIn: "Sign in",
    signUp: "Sign up",
    join: "Join the space",
    error: "Unable to join the space (invalid invitation or space is full).",
    goToDashboard: "Go to dashboard",
  },
} as const;
