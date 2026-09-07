/**
 * "Invitations" page (app/(app)/invitations/page.tsx + invite-form.tsx) and
 * the public accept-invitation page (app/invite/[token]/page.tsx).
 */
export const invitations = {
  title: "Invitations",
  invite: {
    heading: "Invite 2 to 5 friends",
    description: "Each invited user keeps an independent private space.",
    emailLabel: "Friend's email",
    emailInvalid: "A valid email is required",
    submit: "Send invitation",
    createError: "Unable to create invitation",
    createdSuccess: "Invitation created: {link}",
  },
  recent: {
    heading: "Recent invitations",
    empty: "No invitations yet.",
  },
  status: {
    pending: "Pending",
    accepted: "Accepted",
  },
  accept: {
    notFound: "This invitation does not exist.",
    signInPrompt: "Sign in or create an account to accept the invitation.",
    signIn: "Sign in",
    signUp: "Sign up",
    success: "Invitation accepted. Your personal space is now ready.",
    goToDashboard: "Go to dashboard",
  },
} as const;
