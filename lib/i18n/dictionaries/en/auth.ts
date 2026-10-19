export const auth = {
  demo: { view: "View demo" },
  demoUnavailableMessage: "The demo is temporarily unavailable.",
  demoMisconfiguredMessage: "The demo is misconfigured. No demo session was opened.",
  configWarning: "Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to enable auth.",
  emailLabel: "Email",
  passwordLabel: "Password",
  login: {
    title: "Sign in",
    submit: "Sign in",
    noAccount: "No account?",
    createOne: "Create one",
  },
  signup: {
    title: "Create account",
    submit: "Create account",
    alreadyRegistered: "Already registered?",
    signIn: "Sign in",
  },
  signupSuccessMessage: "Signup successful. Confirm your email before logging in.",
  rateLimitedMessage: "Too many attempts. Try again in a few minutes.",
} as const;
