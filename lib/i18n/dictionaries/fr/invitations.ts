/**
 * "Partage" page (app/(app)/invitations/page.tsx, components/spaces/*,
 * invite-form.tsx) and the public accept-invitation page
 * (app/invite/[token]/page.tsx).
 */
export const invitations = {
  title: "Partage",
  current: {
    heading: "Espace actif : {space}",
    headingPersonal: "Espace actif : Personnel",
    personalDescription:
      "Votre espace personnel est privé : personne d'autre n'y a accès. Créez un espace partagé pour gérer un budget commun.",
    sharedDescription:
      "Tous les membres voient et modifient les mêmes comptes, budgets et transactions de cet espace.",
  },
  create: {
    heading: "Créer un espace partagé",
    description:
      "Par exemple « Foyer » pour votre compte joint. Vous en serez le propriétaire et pourrez y inviter d'autres personnes.",
    nameLabel: "Nom de l'espace",
    namePlaceholder: "Foyer",
    nameRequired: "Un nom est requis",
    submit: "Créer l'espace",
    error: "Impossible de créer l'espace",
  },
  members: {
    heading: "Membres",
    owner: "Propriétaire",
    member: "Membre",
    you: "vous",
    remove: "Retirer",
    removeConfirmTitle: "Retirer ce membre ?",
    removeConfirmDescription: "Il n'aura plus accès à cet espace. Ce qu'il y a saisi reste dans l'espace.",
  },
  invite: {
    heading: "Inviter quelqu'un",
    description: "La personne invitée rejoint cet espace avec les mêmes droits que vous sur les données.",
    emailLabel: "Email",
    emailInvalid: "Un email valide est requis",
    submit: "Créer le lien d'invitation",
    createError: "Impossible de créer l'invitation",
    createdSuccess: "Invitation créée. Envoyez-lui ce lien : {link}",
  },
  recent: {
    heading: "Invitations",
    empty: "Aucune invitation pour cet espace.",
  },
  status: {
    pending: "En attente",
    accepted: "Acceptée",
    revoked: "Révoquée",
  },
  revoke: "Révoquer",
  danger: {
    heading: "Zone sensible",
    leave: "Quitter l'espace",
    leaveConfirmTitle: "Quitter cet espace ?",
    leaveConfirmDescription: "Vous n'y aurez plus accès. Ce que vous y avez saisi reste dans l'espace.",
    delete: "Supprimer l'espace",
    deleteConfirmTitle: "Supprimer cet espace ?",
    deleteConfirmDescription:
      "Tous ses comptes, transactions et budgets seront supprimés pour tous les membres. Cette action est irréversible.",
    confirming: "En cours…",
    cancel: "Annuler",
    error: "Action impossible",
  },
  accept: {
    notFound: "Cette invitation n'existe pas.",
    unavailable: "Cette invitation n'est plus valide (déjà utilisée, révoquée ou expirée).",
    summary: "{inviter} vous invite à rejoindre l'espace « {space} ».",
    signInPrompt: "Connectez-vous ou créez un compte pour accepter l'invitation.",
    signIn: "Se connecter",
    signUp: "S'inscrire",
    join: "Rejoindre l'espace",
    error: "Impossible de rejoindre l'espace (invitation invalide ou espace complet).",
    goToDashboard: "Aller au tableau de bord",
  },
} as const;
