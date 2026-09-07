/**
 * "Invitations" page (app/(app)/invitations/page.tsx + invite-form.tsx) and
 * the public accept-invitation page (app/invite/[token]/page.tsx).
 */
export const invitations = {
  title: "Invitations",
  invite: {
    heading: "Invitez 2 à 5 amis",
    description: "Chaque utilisateur invité conserve un espace privé indépendant.",
    emailLabel: "Email de l'ami",
    emailInvalid: "Un email valide est requis",
    submit: "Envoyer l'invitation",
    createError: "Impossible de créer l'invitation",
    createdSuccess: "Invitation créée : {link}",
  },
  recent: {
    heading: "Invitations récentes",
    empty: "Aucune invitation pour l'instant.",
  },
  status: {
    pending: "En attente",
    accepted: "Acceptée",
  },
  accept: {
    notFound: "Cette invitation n'existe pas.",
    signInPrompt: "Connectez-vous ou créez un compte pour accepter l'invitation.",
    signIn: "Se connecter",
    signUp: "S'inscrire",
    success: "Invitation acceptée. Votre espace personnel est maintenant prêt.",
    goToDashboard: "Aller au tableau de bord",
  },
} as const;
