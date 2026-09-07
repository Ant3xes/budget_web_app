/**
 * "Profil" settings page (app/(app)/settings/profile/page.tsx +
 * components/settings/profile-form.tsx): display-name form + password form.
 */
export const profile = {
  title: "Profile",
  description: "Edit your display name and password.",
  info: {
    heading: "Information",
    nameLabel: "Display name",
    nameRequired: "Name is required",
    saveError: "Unable to save",
    updateSuccess: "Name updated.",
  },
  security: {
    heading: "Security",
    currentPasswordLabel: "Current password",
    currentPasswordRequired: "Current password is required",
    newPasswordLabel: "New password",
    newPasswordMin: "Minimum 8 characters",
    confirmPasswordLabel: "Confirm new password",
    passwordMismatch: "Passwords do not match",
    changeError: "Unable to change password",
    updateSuccess: "Password updated.",
    submit: "Change password",
  },
} as const;
