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

export const homeStrings = {
  greetingFallback: "Relativity Explorer",
  labTitle: "Lab",
  labDescription: "Open the relativity playground.",
  quizTitle: "Quiz",
  quizDescription: "Solve numeric relativity questions.",
} as const;

export const quizStrings = {
  loading: "Loading questions...",
  current: "Questions are current.",
  cached: "Using saved questions.",
  firstRunOffline: "Questions are not available offline yet",
  dataError: "Question data could not be loaded.",
  networkError: "Question loading failed. Check your connection and try again.",
  retryQuestions: "Retry question load",
  retryProgress: "Retry progress sync",
  invalidAnswer: "Enter a valid number.",
  blankAnswer: "Enter an answer before submitting.",
  incorrect: "Not quite. Edit your answer and try again.",
  correct: "Correct. Progress recorded.",
  saving: "Recording progress...",
  saveError: "Correct, but progress could not sync. Retry progress sync.",
  syncPending: "Progress will sync when online.",
  solved: "Solved",
  unsolved: "Unsolved",
  submit: "Submit answer",
  previous: "Previous",
  next: "Next",
  home: "Home",
} as const;

export const profileStrings = {
  guestDescription:
    "Guest progress is stored on this device. Sign in to preserve and merge progress across devices.",
  solvedHeading: "Solved questions",
  solvedEmpty: "Solved questions will appear here.",
  solvedCount: "Solved",
  unknownQuestion: "Unknown question",
  syncSynced: "Progress synced.",
  syncPending: "Progress will sync when online.",
  syncFailed: "Progress sync failed.",
  retrySync: "Retry sync",
} as const;
