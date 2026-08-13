export const authStrings = {
  appName: "RelativityLab",
  tagline: "Warp Space, Bend Time.",
  actions: {
    google: "Continue with Google",
    apple: "Continue with Apple",
    guest: "Continue as guest",
  },
  hints: {
    google: "Use your Google account to continue.",
    apple: "Use your Apple account to continue.",
    guest: "Explore without signing in.",
  },
  activeLabels: {
    google: "Connecting to Google...",
    apple: "Connecting to Apple...",
    guest: "Starting guest session...",
    signOut: "Signing out...",
  },
  messages: {
    cancelled: "Sign-in was cancelled.",
    network: "Check your internet connection and try again.",
    credential: "We could not verify your sign-in. Please try again.",
    config: "Sign-in is not configured correctly.",
    unavailable: "This sign-in option is not available right now.",
    accountConflict: "This account is already linked to another sign-in method.",
    unknown: "Something went wrong. Please try again.",
  },
} as const;
