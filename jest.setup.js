jest.mock("@react-native-firebase/app", () => ({
  getApp: jest.fn(() => ({ name: "[DEFAULT]" })),
  initializeApp: jest.fn(() => ({ name: "[DEFAULT]" })),
}));

jest.mock("@react-native-firebase/auth", () => jest.fn(() => ({})));
jest.mock("@react-native-firebase/firestore", () => jest.fn(() => ({})));
jest.mock("@react-native-google-signin/google-signin", () => ({
  GoogleSignin: {
    configure: jest.fn(),
  },
}));

process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "test-google-web-client-id";
