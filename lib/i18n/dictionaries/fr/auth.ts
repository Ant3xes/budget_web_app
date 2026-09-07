export const auth = {
  configWarning: "Configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY pour activer l'authentification.",
  // Kept as "Email" (not "E-mail"): several e2e specs (auth.spec.ts,
  // import.spec.ts, transactions.spec.ts, features.spec.ts,
  // profile-plan.spec.ts) locate this field via `getByLabel(/email/i)`,
  // which a hyphenated label wouldn't match.
  emailLabel: "Email",
  passwordLabel: "Mot de passe",
  login: {
    title: "Connexion",
    submit: "Se connecter",
    noAccount: "Pas de compte ?",
    createOne: "En créer un",
  },
  signup: {
    title: "Créer un compte",
    submit: "Créer le compte",
    alreadyRegistered: "Déjà inscrit ?",
    signIn: "Se connecter",
  },
  /** Matches the `?message=signupSuccess` sentinel `(auth)/actions.ts` redirects with — the login page resolves it via this key instead of a raw (unlocalizable) literal in the server action. Any other `?message=` value is Supabase's own auth error text, shown as-is (untranslated — it comes from the auth library, not this app). */
  signupSuccessMessage: "Inscription réussie. Confirmez votre e-mail avant de vous connecter.",
} as const;
