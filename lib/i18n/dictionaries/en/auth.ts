export const auth = {
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
} as const;
