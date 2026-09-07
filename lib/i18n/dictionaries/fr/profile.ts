/**
 * "Profil" settings page (app/(app)/settings/profile/page.tsx +
 * components/settings/profile-form.tsx): display-name form + password form.
 */
export const profile = {
  title: "Profil",
  description: "Modifiez votre nom d'affichage et votre mot de passe.",
  info: {
    heading: "Informations",
    nameLabel: "Nom d'affichage",
    nameRequired: "Nom requis",
    saveError: "Impossible de sauvegarder",
    updateSuccess: "Nom mis à jour.",
  },
  security: {
    heading: "Sécurité",
    currentPasswordLabel: "Mot de passe actuel",
    currentPasswordRequired: "Mot de passe actuel requis",
    newPasswordLabel: "Nouveau mot de passe",
    newPasswordMin: "8 caractères minimum",
    confirmPasswordLabel: "Confirmer le nouveau mot de passe",
    passwordMismatch: "Les mots de passe ne correspondent pas",
    changeError: "Impossible de changer le mot de passe",
    updateSuccess: "Mot de passe mis à jour.",
    submit: "Changer le mot de passe",
  },
} as const;
